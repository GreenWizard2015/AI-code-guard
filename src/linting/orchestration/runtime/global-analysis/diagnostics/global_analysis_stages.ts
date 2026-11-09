import { CallableUsage } from "src/callable_usage";
import { PYTHON_LANGUAGE, TEST_PATH_SUFFIXES, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { CompositionModelContract } from "src/contracts/protocols/composition_protocols";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { CompositionAnalyzer } from "src/linting/composition/composition_analyzer";
import { CompositionModel } from "src/linting/composition/composition_model";
import { SharedParameterAdapter } from "src/metrics/shared_parameter/shared_parameter_adapter";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter/shared_parameter_analyzer";
import { SharedParameterReporter } from "src/metrics/shared_parameter/shared_parameter_reporter";
import type { AnalyzedCallable } from "src/metrics/types";
import type { SharedParameterTypeSourcesContract } from "src/metrics/types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassRules } from "src/rules/class_rules";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import { SharedParameterTypeSources } from "src/shared_parameter_type_sources";
import type {
	GlobalAnalysisStageOptions,
	LintProjectContextContract,
	LintStageTimerContract,
	TestPathSyntaxContract,
} from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _global analysis coordination_, _stage violation collection_. **/
export class GlobalAnalysisStages {
	private readonly _repo_root: string;
	private readonly _project_files: string[];
	private readonly _project_type_names: ReadonlySet<string>;
	private readonly _context: LintProjectContextContract;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _composition_model: CompositionModelContract;
	private readonly _import_context: PythonProjectImportContext;
	private readonly _type_sources: SharedParameterTypeSourcesContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	public readonly _project_source_scanner: ProjectSourceScanContract;

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
		const type_sources = this._type_sources.collect();
		const production_files = this._project_files.filter((file) =>
			this._context.source_record(file).file_name.product(),
		);
		for (const file of production_files) {
			const source = this._context.source_record(file);
			const adapter = new SharedParameterAdapter({
				file: source.relative_path,
				kind: MODULE_FUNCTION_KIND,
				nodes: source.normalized_ast.source.functions,
				type_sources,
				project_types: this._project_type_names,
				reference_aliases: source.normalized_ast.references.reference_aliases,
				language: source.language,
			});
			callables.push(...adapter.callables());
		}
		return this.group_callables(callables);
	}

	/** Responsibilities: _Python AST snapshot_. **/
	private python_ast_snapshot(): ReadonlyMap<string, NormalizedAstFile> {
		return new Map<string, NormalizedAstFile>(
			this._context
				.files()
				.filter((source) => source.language === "python")
				.map((source) => [source.absolute_path, source.normalized_ast]),
		);
	}

	/** Responsibilities: _time collection project-wide class-field_. **/
	private class_fields(): ViolationContract[] {
		const class_rules = new ClassRules(this._import_context);
		return this._stage_timer.measure("global-analysis.class-fields", () =>
			class_rules.python_context_fields(
				{ files: this._project_files, repo_root: this._repo_root },
				this._context,
				this._stage_timer,
			),
		);
	}

	/** Responsibilities: _time collection composition violations_. **/
	private composition(): ViolationContract[] {
		const sources = this.production_composition_sources();
		return this._stage_timer.measure("global-analysis.composition", () => {
			const graph = this._composition_model.class_graph(sources);
			const analyzer = new CompositionAnalyzer(graph, this._repo_root);
			return this.python_violations(analyzer.violations());
		});
	}

	/** Responsibilities: _Python-only global result delivery_. **/
	private python_violations(violations: ViolationContract[]): ViolationContract[] {
		const python_files = new Set(
			this._context
				.files()
				.filter((source) => source.language === "python")
				.map((source) => source.relative_path),
		);
		return violations.filter((violation) => python_files.has(violation.file()));
	}

	/** Responsibilities: _composition source filtering_. **/
	private production_composition_sources(): LintSourceRecordData[] {
		const production: LintSourceRecordData[] = [];
		for (const source of this._context.files()) {
			if (source.language !== PYTHON_LANGUAGE) {
				continue;
			}
			if (this._test_path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
				continue;
			}
			production.push(source);
		}
		return production;
	}

	/** Responsibilities: _time collection callable usage_. **/
	private callable_usage(): ViolationContract[] {
		const sources = this._context.files().filter((source) => source.language === PYTHON_LANGUAGE);
		const files = sources.map((source) => source.absolute_path);
		const callable_usage = new CallableUsage({
			project_root: this._repo_root,
			project_files: files,
			import_context: { ...this._import_context, files: new Set(files) },
			project_source_scanner: this._project_source_scanner,
			source_asts: this.python_ast_snapshot(),
			sources,
			stage_timer: this._stage_timer,
		});
		return this._stage_timer.measure("global-analysis.callable-usage", () =>
			this.python_violations(callable_usage.collect_timed_usage()),
		);
	}

	/** Responsibilities: _shared analysis initialization_. **/
	public constructor(options: GlobalAnalysisStageOptions) {
		this._repo_root = options.repo_root;
		this._project_files = options.project_files;
		this._project_type_names = options.project_type_names;
		this._context = options.context;
		this._stage_timer = options.stage_timer;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._import_context = {
			root: options.repo_root,
			files: new Set(options.project_files),
			resolver: new ProjectSourcePython(options.repo_root),
		};
		this._type_sources = new SharedParameterTypeSources(
			options.repo_root,
			options.project_files,
			options.context,
			this._import_context,
		);
		this._composition_model = new CompositionModel(
			options.repo_root,
			this._import_context,
			new Map(
				options.context
					.files()
					.filter((source) => source.language === TYPESCRIPT_CACHE_OWNER)
					.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
			),
			false,
			options.context.source_io(),
		);
		this._project_source_scanner = options.project_scope.scanner;
	}

	/** Responsibilities: _collection reporting shared parameter_. **/
	public parameter_violations(language: string): ViolationContract[] {
		return this._stage_timer.measure(`rule.shared-parameter.${language}-module-functions`, () => {
			const groups = this.callable_groups();
			const candidates = groups
				.filter((group) => group.every((callable) => callable.language === language))
				.flatMap((callable_group) => {
					const analyzer = new SharedParameterAnalyzer(callable_group);
					return analyzer.collect_candidates();
				});
			const reporter = new SharedParameterReporter(candidates);
			return reporter.violations();
		});
	}

	/** Responsibilities: _collection shared analysis violations_. **/
	public collect(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		violations.push(...this.class_fields());
		violations.push(...this.composition());
		violations.push(...this.callable_usage());
		violations.push(...this.parameter_violations("python"));
		return violations;
	}
}
