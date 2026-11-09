import { PYTHON_LANGUAGE, TEST_PATH_SUFFIXES } from "src/constants";
import { UNUSED_SYMBOL_KIND } from "src/core/types";
import { GlobalAnalysisStages } from "src/linting/orchestration/runtime/global-analysis/diagnostics/global_analysis_stages";
import { LiteralConstantRules } from "src/linting/orchestration/runtime/global-analysis/diagnostics/literal_constant_rules";
import { TestFrameworkConsistency } from "src/linting/orchestration/runtime/global-analysis/diagnostics/test_framework_consistency";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { GlobalViolationCollectorOptions } from "src/project_analysis_types";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { ModulePlacementAnalyzer } from "src/rules/architecture/module_placement_analyzer";
import { ProductionTestImportAnalyzer } from "src/rules/architecture/production_test_import_analyzer";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { UnusedSymbolRules } from "src/unused_symbol_rules";

/** Responsibilities: _global violation orchestration_, _targeted violation collection_. **/
export class GlobalViolationCollector {
	private readonly _context: LintProjectContextContract;
	private readonly _stage_timer: LintStageTimerContract;

	private readonly _test_framework_consistency: TestFrameworkConsistency;

	private readonly _analysis_stages: GlobalAnalysisStages;

	private readonly _project_source_scanner: ProjectSourceScanContract;

	private readonly _unused_symbol_rules: UnusedSymbolRules;

	private readonly _literal_constant_rules: LiteralConstantRules;

	private readonly _project_scope: ProjectSourceAnalysisOptions;

	/** Responsibilities: _time collection module-placement violations_. **/
	private module_placement_stage(): ViolationContract[] {
		const module_placement = new ModulePlacementAnalyzer(this._project_scope);
		return this._stage_timer.measure("global-analysis.module-placement", () =>
			module_placement.collect_language_violations(module_placement.collect_importers(), "python"),
		);
	}

	/** Responsibilities: _test import timing_. **/
	private test_import_stage(): ViolationContract[] {
		const analyzer = new ProductionTestImportAnalyzer(this._project_scope);
		return this._stage_timer.measure("global-analysis.production-test-import", () =>
			analyzer.language_violations("python"),
		);
	}

	/** Responsibilities: _Python unused-symbol result delivery_. **/
	private unused_python_symbols(): ViolationContract[] {
		const python_files = new Set(
			this._context
				.files()
				.filter((source) => source.language === "python")
				.map((source) => source.relative_path),
		);
		return this._unused_symbol_rules.collect().filter((violation) => python_files.has(violation.file()));
	}

	/** Responsibilities: _initialization project inputs shared_. **/
	public constructor(options: GlobalViolationCollectorOptions) {
		this._test_framework_consistency = new TestFrameworkConsistency(
			new DiagnosticRule("python-test-framework-consistency"),
		);
		this._context = options.context;
		this._stage_timer = options.stage_timer;
		this._project_scope = options.project_scope;
		this._analysis_stages = new GlobalAnalysisStages({
			repo_root: options.repo_root,
			project_files: options.project_files,
			project_type_names: options.project_type_names,
			context: options.context,
			stage_timer: options.stage_timer,
			entry_files: options.entry_files,
			project_scope: options.project_scope,
		});
		this._project_source_scanner = options.project_scope.scanner;
		this._unused_symbol_rules = new UnusedSymbolRules(
			new TestPathSyntax(TEST_PATH_SUFFIXES),
			new Map([
				[UNUSED_SYMBOL_KIND.Class, new DiagnosticRule("unused-class")],
				[UNUSED_SYMBOL_KIND.Constant, new DiagnosticRule("unused-constant")],
				[UNUSED_SYMBOL_KIND.Type, new DiagnosticRule("unused-type")],
				[UNUSED_SYMBOL_KIND.PublicField, new DiagnosticRule("unused-public-field")],
				[UNUSED_SYMBOL_KIND.ModuleVariable, new DiagnosticRule("unused-module-variable")],
			]),
			new DiagnosticRule("test-only-usage"),
			this._context.files().filter((source) => source.language === PYTHON_LANGUAGE),
			this._project_source_scanner,
		);
		this._literal_constant_rules = new LiteralConstantRules(
			new DiagnosticRule("literal-constant-reuse"),
			new DiagnosticRule("repeated-literal"),
			this._stage_timer,
		);
	}

	/** Responsibilities: _execution project-wide analysis stages_. **/
	public collect(): ViolationContract[] {
		return [
			...this._analysis_stages.collect(),
			...this._stage_timer.measure("global-analysis.unused-symbols", () => this.unused_python_symbols()),
			...this._stage_timer.measure("global-analysis.literal-constants", () =>
				this._literal_constant_rules.violations_for_language(this._context, "python"),
			),
			...this.module_placement_stage(),
			...this.test_import_stage(),
			...this._stage_timer.measure("global-analysis.test-framework", () =>
				this._test_framework_consistency.violations(this._context),
			),
		];
	}

	/** Responsibilities: _collection project-wide violations retention_. **/
	public collect_for(target_files: ReadonlySet<string>): ViolationContract[] {
		const violations = this.collect();
		if (target_files.size === 0) {
			return [];
		}
		return violations.filter((violation) => target_files.has(violation.file()));
	}
}
