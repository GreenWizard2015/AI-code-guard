import { ModulePlacementAnalyzer } from "src/linting/orchestration/runtime/global-analysis/module_placement_analyzer";
import { ProductionTestImportAnalyzer } from "src/linting/orchestration/runtime/global-analysis/production_test_import_analyzer";
import { TestFrameworkConsistency } from "src/linting/orchestration/runtime/global-analysis/test_framework_consistency";
import type { LintProjectContextContract, LintStageTimerContract, ProjectSourceScannerContract, ViolationContract } from "src/protocols";
import { GlobalAnalysisStages } from "src/linting/orchestration/runtime/global-analysis/global_analysis_stages";
import { UnusedSymbolRules } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_rules";
import { LiteralConstantRules } from "src/linting/orchestration/runtime/global-analysis/literal_constant_rules";
import type { GlobalViolationCollectorOptions } from "src/linting/orchestration/runtime/global-analysis/protocols";

/** Responsibilities: _global violation orchestration_, _targeted violation collection_. **/
export class GlobalViolationCollector {
	private readonly repo_root: string;

	private readonly project_files: string[];

	private readonly context: LintProjectContextContract;

	private readonly ignored_files: ReadonlySet<string>;

	private readonly test_framework_consistency: TestFrameworkConsistency;

	private readonly analysis_stages: GlobalAnalysisStages;

	private readonly project_source_scanner: ProjectSourceScannerContract;

	private readonly available_files: Set<string>;

	private readonly unused_symbol_rules: UnusedSymbolRules;

	private readonly literal_constant_rules: LiteralConstantRules;

	/** Responsibilities: _time collection module-placement violations_. **/
	private module_placement_stage(stage_timer: LintStageTimerContract): ViolationContract[] {
		const module_placement = new ModulePlacementAnalyzer({
			root: this.repo_root,
			project_files: this.project_files,
			context: this.context,
			ignored_files: this.ignored_files,
			scanner: this.project_source_scanner,
			files: this.available_files,
		});
		return stage_timer.measure("global-analysis.module-placement", () => module_placement.collect_violations());
	}

	/** Responsibilities: _test import timing_. **/
	private test_import_stage(stage_timer: LintStageTimerContract): ViolationContract[] {
		const analyzer = new ProductionTestImportAnalyzer({
			root: this.repo_root,
			project_files: this.project_files,
			context: this.context,
			ignored_files: this.ignored_files,
			scanner: this.project_source_scanner,
			files: this.available_files,
		});
		return stage_timer.measure("global-analysis.production-test-import", () => analyzer.collect_violations());
	}

	/** Responsibilities: _initialization project inputs shared_. **/
	public constructor(options: GlobalViolationCollectorOptions) {
		this.test_framework_consistency = new TestFrameworkConsistency();
		this.repo_root = options.repo_root;
		this.project_files = options.project_files;
		this.available_files = new Set(options.project_files);
		this.context = options.context;
		this.ignored_files = options.ignored_files;
		this.analysis_stages = new GlobalAnalysisStages(
			options.repo_root,
			options.project_files,
			options.project_type_names,
			options.context,
			options.entry_files,
		);
		this.project_source_scanner = this.analysis_stages.project_source_scanner;
		this.unused_symbol_rules = new UnusedSymbolRules();
		this.literal_constant_rules = new LiteralConstantRules();
	}

	/** Responsibilities: _execution project-wide analysis stages_. **/
	public collect(stage_timer: LintStageTimerContract): ViolationContract[] {
		return [
			...this.analysis_stages.collect(stage_timer),
			...stage_timer.measure("global-analysis.unused-symbols", () =>
				this.unused_symbol_rules.collect(this.context.files(), this.project_source_scanner),
			),
			...stage_timer.measure("global-analysis.literal-constants", () =>
				this.literal_constant_rules.violations(this.context),
			),
			...this.module_placement_stage(stage_timer),
			...this.test_import_stage(stage_timer),
			...stage_timer.measure("global-analysis.test-framework", () =>
				this.test_framework_consistency.violations(this.context),
			),
		];
	}

	/** Responsibilities: _collection project-wide violations retention_. **/
	public collect_for(target_files: ReadonlySet<string>, stage_timer: LintStageTimerContract): ViolationContract[] {
		const violations = this.collect(stage_timer);
		if (target_files.size === 0) {
			return [];
		}
		return violations.filter((violation) => target_files.has(violation.file));
	}
}
