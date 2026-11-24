import type { ProjectRuleSnapshotRecordContract } from "src/model/protocols";
import { ViolationValue } from "src/model/violation_value";
import type { ProjectRuleSnapshot } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _project rule snapshot serialization_, _diagnostic restoration_. **/
export class ProjectRuleSnapshotRecord implements ProjectRuleSnapshotRecordContract {
	private readonly _snapshot: ProjectRuleSnapshot;

	/** Responsibilities: _project rule snapshot initialization_. **/
	public constructor(snapshot: ProjectRuleSnapshot) {
		this._snapshot = snapshot;
	}

	/** Responsibilities: _snapshot data serialization_. **/
	public serialized(): ProjectRuleSnapshot {
		const files = this._snapshot.files.map((file) => ({
			file: file.file,
			violations: file.violations.map((violation) => ({ ...violation })),
		}));
		return { rule_name: this._snapshot.rule_name, files };
	}

	/** Responsibilities: _project rule violation restoration_. **/
	public restore(): Map<string, ViolationContract[]> {
		const restored = new Map<string, ViolationContract[]>();
		for (const file of this._snapshot.files) {
			const violations = file.violations.map((options) => new ViolationValue(options));
			restored.set(file.file, violations);
		}
		return restored;
	}
}
