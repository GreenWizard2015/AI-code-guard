import { ClassRules } from "src/rules/class_rules";
import { CallableUsage } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { CompositionAnalyzer } from "src/linting/orchestration/runtime/composition/components/composition_analyzer";
import { CompositionModel } from "src/linting/orchestration/runtime/global-analysis/composition_model";
import { TestPathSyntax } from "src/test_path_syntax";
import type { CompositionModelContract } from "src/linting/orchestration/runtime/composition/protocols";
import { SharedParameterAdapter } from "src/metrics/shared_parameter_adapter";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter_analyzer";
import { SharedParameterReporter } from "src/metrics/shared_parameter_reporter";
import { SharedParameterTypeSources } from "src/linting/orchestration/runtime/global-analysis/shared_parameter_type_sources";
import type { AnalyzedCallable } from "src/metrics/types";
import type {
	LintProjectContextContract,
	LintStageTimerContract,
	ProjectSourceScannerContract,
	ViolationContract,
} from "src/protocols";
import type { LintSourceRecord, NormalizedAstFile, PythonProjectImportContext } from "src/types";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import type { SharedParameterTypeSourcesContract } from "src/metrics/types";

/** Responsibilities: _global analysis coordination_, _stage violation collection_. **/
export class GlobalAnalysisStages {
	private readonly repo_root: string;
	private readonly project_files: string[];
	private readonly project_type_names: ReadonlySet<string>;
	private readonly context: LintProjectContextContract;
	private readonly composition_model: CompositionModelContract;
	private readonly import_context: PythonProjectImportContext;
	private readonly type_sources: SharedParameterTypeSourcesContract;
	private readonly test_path_syntax: TestPathSyntax;
	private readonly supported_composition_extensions: readonly string[] = [".py", ".ts", ".tsx"];
	public readonly project_source_scanner: ProjectSourceScannerContract;

	/** Responsibilities: _group analysis callables source_. **/
	private group_callables(callables: AnalyzedCallable[]): AnalyzedCallable[][] {
		const groups = new Map<string, AnalyzedCallable[]>();
		for (const callable of callables) {
			const language = callable.language;
			if (language === undefined) {
				continue;
			}
			let group = groups.get(language);
			if (group === undefined) {
				group = [];
				groups.set(language, group);
			}
			group.push(callable);
		}
		return [...groups.values()];
	}

	/** Responsibilities: _production callables group adaptation_. **/
	private callable_groups(): AnalyzedCallable[][] {
		const callables: AnalyzedCallable[] = [];
		const type_sources = this.type_sources.collect();
		const production_files = this.project_files.filter((file) => this.context.source_record(file).file_name.product());
		for (const file of production_files) {
			const source = this.context.source_record(file);
			const adapter = new SharedParameterAdapter({
				file: source.relative_path,
				kind: MODULE_FUNCTION_KIND,
				nodes: source.normalized_ast.functions,
				type_sources,
				project_types: this.project_type_names,
				reference_aliases: source.normalized_ast.reference_aliases,
				language: source.language,
			});
			callables.push(...adapter.callables());
		}
		return this.group_callables(callables);
	}

	/** Responsibilities: _Python AST snapshot_. **/
	private python_ast_snapshot(): ReadonlyMap<string, NormalizedAstFile> {
		return new Map<string, NormalizedAstFile>(
			this.context
				.files()
				.filter((source) => source.language === "python")
				.map((source) => [source.absolute_path, source.normalized_ast]),
		);
	}

	/** Responsibilities: _time collection project-wide class-field_. **/
	private class_fields(stage_timer: LintStageTimerContract): ViolationContract[] {
		const class_rules = new ClassRules(this.import_context);
		return stage_timer.measure("global-analysis.class-fields", () =>
			class_rules.collect_context_fields(
				{ files: this.project_files, repo_root: this.repo_root },
				this.context,
				stage_timer,
			),
		);
	}

	/** Responsibilities: _time collection composition violations_. **/
	private composition(stage_timer: LintStageTimerContract): ViolationContract[] {
		const sources = this.production_composition_sources();
		return stage_timer.measure("global-analysis.composition", () => {
			const graph = this.composition_model.class_graph(sources);
			const analyzer = new CompositionAnalyzer(graph, this.repo_root);
			return analyzer.violations();
		});
	}

	/** Responsibilities: _composition source filtering_. **/
	private production_composition_sources(): LintSourceRecord[] {
		const production: LintSourceRecord[] = [];
		for (const source of this.context.files()) {
			if (!this.supported_composition_extensions.some((extension) => source.absolute_path.endsWith(extension))) {
				continue;
			}
			if (this.test_path_syntax.test_file(source.relative_path)) {
				continue;
			}
			production.push(source);
		}
		return production;
	}

	/** Responsibilities: _time collection callable usage_. **/
	private callable_usage(stage_timer: LintStageTimerContract): ViolationContract[] {
		const callable_usage = new CallableUsage(
			this.repo_root,
			this.project_files,
			this.import_context,
			this.project_source_scanner,
			this.python_ast_snapshot(),
		);
		return stage_timer.measure("global-analysis.callable-usage", () =>
			callable_usage.collect_timed_usage(this.context.files(), stage_timer),
		);
	}

	/** Responsibilities: _shared analysis initialization_. **/
	constructor(
		repo_root: string,
		project_files: string[],
		project_type_names: ReadonlySet<string>,
		context: LintProjectContextContract,
		entry_files: readonly string[] = [],
	) {
		this.repo_root = repo_root;
		this.project_files = project_files;
		this.project_type_names = project_type_names;
		this.context = context;
		this.test_path_syntax = new TestPathSyntax();
		this.import_context = {
			root: repo_root,
			files: new Set(project_files),
			resolver: new ProjectSourcePython(),
		};
		this.type_sources = new SharedParameterTypeSources(repo_root, project_files, context, this.import_context);
		this.composition_model = new CompositionModel(
			repo_root,
			this.import_context,
			new Map(
				context
					.files()
					.filter((source) => source.typescript())
					.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
			),
			false,
			context.source_io,
		);
		this.project_source_scanner = new ProjectSourceScanner(repo_root, {
			context_state: { available: true, value: context },
			entry_files,
		});
	}

	/** Responsibilities: _collection reporting shared parameter_. **/
	public parameter_violations(): ViolationContract[] {
		const candidates = this.callable_groups().flatMap((callable_group) => {
			const analyzer = new SharedParameterAnalyzer(callable_group);
			return analyzer.collect_candidates();
		});
		const reporter = new SharedParameterReporter(candidates);
		return reporter.violations();
	}

	/** Responsibilities: _collection shared analysis violations_. **/
	public collect(stage_timer: LintStageTimerContract): ViolationContract[] {
		return [
			...this.class_fields(stage_timer),
			...this.composition(stage_timer),
			...this.callable_usage(stage_timer),
			...this.parameter_violations(),
		];
	}
}
