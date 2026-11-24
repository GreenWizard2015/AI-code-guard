import { CallableUsage } from "src/callable_usage";
import { PYTHON_LANGUAGE } from "src/constants";
import type {
	GlobalAnalysisCallableGroups,
	GlobalAnalysisCallableStagesOptions,
} from "src/linting/orchestration/runtime/global-analysis/diagnostics/types";
import { SharedParameterAdapter } from "src/metrics/shared_parameter/shared_parameter_adapter";
import { SharedParameterAnalyzer } from "src/metrics/shared_parameter/shared_parameter_analyzer";
import { SharedParameterReporter } from "src/metrics/shared_parameter/shared_parameter_reporter";
import type { AnalyzedCallable, SharedParameterTypeSourcesContract } from "src/metrics/types";
import type { ViolationContract } from "src/reporting_protocols";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import { SharedParameterTypeSources } from "src/rules/shared_parameter_type_sources";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _callable usage diagnostics_, _shared parameter diagnostics_. **/
export class GlobalAnalysisCallableStages {
	private readonly _repo_root: string;
	private readonly _project_files: readonly string[];
	private readonly _project_type_names: ReadonlySet<string>;
	private readonly _context: LintProjectContextContract;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _project_source_scanner: ProjectSourceScanContract;
	private readonly _import_context: PythonProjectImportContext;
	private readonly _type_sources: SharedParameterTypeSourcesContract;

	/** Responsibilities: _language-specific callable groups_. **/
	private group_callables(callables: AnalyzedCallable[]): GlobalAnalysisCallableGroups {
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

	/** Responsibilities: _production callable groups_. **/
	private callable_groups(): GlobalAnalysisCallableGroups {
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

	/** Responsibilities: _project callable analysis dependencies_. **/
	public constructor(options: GlobalAnalysisCallableStagesOptions) {
		this._repo_root = options.repo_root;
		this._project_files = options.project_files;
		this._project_type_names = options.project_type_names;
		this._context = options.context;
		this._stage_timer = options.stage_timer;
		this._project_source_scanner = options.project_source_scanner;
		this._import_context = options.import_context;
		this._type_sources = new SharedParameterTypeSources(
			options.repo_root,
			options.project_files,
			options.context,
			options.import_context,
		);
	}

	/** Responsibilities: _Python-only violations_. **/
	public python_violations(violations: ViolationContract[]): ViolationContract[] {
		const python_files = new Set(
			this._context
				.files()
				.filter((source) => source.language === PYTHON_LANGUAGE)
				.map((source) => source.relative_path),
		);
		return violations.filter((violation) => python_files.has(violation.file()));
	}

	/** Responsibilities: _Python callable usage collection_. **/
	public callable_usage_violations(): ViolationContract[] {
		const sources = this._context.files().filter((source) => source.language === PYTHON_LANGUAGE);
		const files = sources.map((source) => source.absolute_path);
		const usage = new CallableUsage({
			project_root: this._repo_root,
			project_files: files,
			import_context: { ...this._import_context, files: new Set(files) },
			project_source_scanner: this._project_source_scanner,
			source_asts: new Map(sources.map((source) => [source.absolute_path, source.normalized_ast] as const)),
			sources,
			stage_timer: this._stage_timer,
		});
		return this._stage_timer.measure("global-analysis.callable-usage", () =>
			this.python_violations(usage.collect_timed_usage()),
		);
	}

	/** Responsibilities: _language-specific shared parameter violations_. **/
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
}
