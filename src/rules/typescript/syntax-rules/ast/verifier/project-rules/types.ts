import type { ProjectSourceAnalysisOptionsContract } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _project rule violation maps_. **/
export type ProjectRuleViolationMap = ReadonlyMap<string, readonly ViolationContract[]>;

/** Responsibilities: _mutable project rule violation grouping_. **/
export type MutableProjectRuleViolationMap = Map<string, ViolationContract[]>;

/** Responsibilities: _project rule violation collection_. **/
export type CallableProjectRuleViolationMapCollector = () => ProjectRuleViolationMap;

/** Responsibilities: _class-field project analysis_. **/
export type ProjectClassFieldAnalysisRequest = {
	scope: ProjectSourceAnalysisOptionsContract;
	stage_timer: LintStageTimerContract;
};

/** Responsibilities: _project rule result access_. **/
export interface ProjectRuleResultCacheContract {
	grouped(
		scope: ProjectSourceAnalysisOptionsContract,
		rule_name: string,
		collect: CallableProjectRuleViolationMapCollector,
	): ProjectRuleViolationMap;
}

/** Responsibilities: _project rule collection input_. **/
export type ProjectRuleResultCollection = {
	readonly scope: ProjectSourceAnalysisOptionsContract;
	readonly rule_name: string;
	readonly collect: CallableProjectRuleViolationMapCollector;
};
