import { ProjectRuleSnapshotRecord } from "src/model/project_rule_snapshot_record";
import type { ProjectRuleSnapshotCaptureContract, ProjectRuleSnapshotRecordContract } from "src/model/protocols";
import type { ProjectRuleSnapshotFile } from "src/project_analysis_types";
import type { ReportViolationOptions, ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _project rule snapshot serialization_, _per-file diagnostics_. **/
export class ProjectRuleSnapshotCapture implements ProjectRuleSnapshotCaptureContract {
	private readonly _rule_name: string;

	/** Responsibilities: _snapshot rule selection_. **/
	public constructor(rule_name: string) {
		this._rule_name = rule_name;
	}

	/** Responsibilities: _file diagnostic serialization_. **/
	public capture_file(file: string, violations: readonly ViolationContract[]): ProjectRuleSnapshotFile {
		const serialized_violations: ReportViolationOptions[] = violations.map((violation) => ({
			file: violation.file(),
			line: violation.line(),
			message: violation.message(),
			hint: violation.hint(),
			rule_id: violation.rule_id(),
			priority: violation.priority(),
		}));
		return { file, violations: serialized_violations };
	}

	/** Responsibilities: _grouped snapshot creation_. **/
	public capture(grouped: ReadonlyMap<string, readonly ViolationContract[]>): ProjectRuleSnapshotRecordContract {
		const files: ProjectRuleSnapshotFile[] = [];
		for (const [file, violations] of grouped) {
			files.push(this.capture_file(file, violations));
		}
		return new ProjectRuleSnapshotRecord({ rule_name: this._rule_name, files });
	}
}
