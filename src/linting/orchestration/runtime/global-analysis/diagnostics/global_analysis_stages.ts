import { PYTHON_LANGUAGE, TEST_PATH_SUFFIXES, TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { CompositionModelContract } from "src/contracts/protocols/composition_protocols";
import type { GlobalAnalysisStagesContract } from "src/contracts/protocols/global_analysis_protocols";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import type { SourceFileResolverContract } from "src/core/project-source/types";
import { CompositionAnalyzer } from "src/linting/composition/composition_analyzer";
import { CompositionModel } from "src/linting/composition/composition_model";
import { GlobalAnalysisCallableStages } from "src/linting/orchestration/runtime/global-analysis/diagnostics/global_analysis_callable_stages";
import type { GlobalAnalysisStageOptions } from "src/linting/orchestration/runtime/global-analysis/diagnostics/types";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassRules } from "src/rules/classes/class_rules";
import type {
	LintProjectContextContract,
	LintStageTimerContract,
	TestPathSyntaxContract,
} from "src/shared_services_protocols";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";
import type ts from "typescript";

/** Responsibilities: _global analysis coordination_, _stage violation collection_. **/
export class GlobalAnalysisStages implements GlobalAnalysisStagesContract {
	private readonly _repo_root: string;
	private readonly _project_files: string[];
	private readonly _context: LintProjectContextContract;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _composition_model: CompositionModelContract;
	private readonly _import_context: PythonProjectImportContext;
	private readonly _callable_stages: GlobalAnalysisCallableStages;
	private readonly _test_path_syntax: TestPathSyntaxContract;

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
			return this._callable_stages.python_violations(analyzer.violations());
		});
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

	/** Responsibilities: _shared analysis initialization_. **/
	public constructor(options: GlobalAnalysisStageOptions) {
		this._repo_root = options.repo_root;
		this._project_files = options.project_files;
		this._context = options.context;
		this._stage_timer = options.stage_timer;
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._import_context = {
			root: options.repo_root,
			files: new Set(options.project_files),
			resolver: new ProjectSourcePython(options.repo_root),
		};
		const project_source_scanner = options.project_scope.scanner();
		this._callable_stages = new GlobalAnalysisCallableStages({
			repo_root: options.repo_root,
			project_files: options.project_files,
			project_type_names: options.project_type_names,
			context: options.context,
			stage_timer: options.stage_timer,
			project_source_scanner,
			import_context: this._import_context,
		});
		const typescript_source = options.context.files().find((source) => source.language === TYPESCRIPT_CACHE_OWNER);
		let source_resolver: SourceFileResolverContract;
		if (typescript_source === undefined) {
			const source_files = new Map<string, ts.SourceFile>();
			const map_cache = new SourceFileMapCache();
			source_resolver = map_cache.for_map(source_files);
		} else {
			source_resolver = typescript_source.source_resolver;
		}
		this._composition_model = new CompositionModel(
			options.repo_root,
			this._import_context,
			source_resolver,
			false,
			options.context.source_io(),
		);
	}

	/** Responsibilities: _collection shared analysis violations_. **/
	public collect(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		violations.push(...this.class_fields());
		violations.push(...this.composition());
		violations.push(...this._callable_stages.callable_usage_violations());
		violations.push(...this._callable_stages.parameter_violations("python"));
		return violations;
	}
}
