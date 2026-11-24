import { ProjectRuleSnapshotCapture } from "src/model/project_rule_snapshot_capture";
import { ProjectRuleSnapshotRecord } from "src/model/project_rule_snapshot_record";
import type { ProjectSourceAnalysisOptionsContract } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CallableProjectRuleViolationMapCollector,
	MutableProjectRuleViolationMap,
	ProjectRuleResultCacheContract,
	ProjectRuleResultCollection,
	ProjectRuleViolationMap,
} from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/types";

/** Responsibilities: _project rule result cache_, _snapshot restoration_. **/
export class TypeScriptProjectRuleResultCache implements ProjectRuleResultCacheContract {
	private readonly _violations_by_scope: WeakMap<ProjectSourceAnalysisOptionsContract, ProjectRuleViolationMap>;

	/** Responsibilities: _project violation grouping_. **/
	private grouped_violations(request: ProjectRuleResultCollection): MutableProjectRuleViolationMap {
		const grouped = new Map<string, ViolationContract[]>();
		for (const [file, violations] of request.collect()) {
			const copied_violations = [...violations];
			grouped.set(file, copied_violations);
		}
		return grouped;
	}

	/** Responsibilities: _snapshot restoration_, _violation collection_. **/
	private restore_or_collect(request: ProjectRuleResultCollection): MutableProjectRuleViolationMap {
		const { scope, rule_name } = request;
		const snapshots = scope.project_rule_snapshots();
		for (const snapshot of snapshots) {
			if (snapshot.rule_name === rule_name) {
				const record = new ProjectRuleSnapshotRecord(snapshot);
				const restored_violations = record.restore();
				return restored_violations;
			}
		}
		const grouped = this.grouped_violations(request);
		if (scope.snapshot_capture_active()) {
			const capture = new ProjectRuleSnapshotCapture(rule_name);
			scope.project_rule_snapshots().push(capture.capture(grouped).serialized());
		}
		return grouped;
	}

	/** Responsibilities: _project result cache initialization_. **/
	public constructor() {
		this._violations_by_scope = new WeakMap();
	}

	/** Responsibilities: _grouped project rule results_. **/
	public grouped(
		scope: ProjectSourceAnalysisOptionsContract,
		rule_name: string,
		collect: CallableProjectRuleViolationMapCollector,
	): ProjectRuleViolationMap {
		const cached = this._violations_by_scope.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const request: ProjectRuleResultCollection = { scope, rule_name, collect };
		const grouped = this.restore_or_collect(request);
		this._violations_by_scope.set(scope, grouped);
		return grouped;
	}
}
