import type { ReportViolation } from "src/reporting_protocols";
import type { TaskWorkspaceDocumentsContract } from "src/task_protocols";
import { TaskReportViolationRows } from "src/core/support/task/reporting/task_report_violation_rows";
import {
	DOCUMENTATION_REPORT_DIVIDER,
	DOCUMENTATION_REPORT_HEADER,
	EMPTY_DOCUMENTATION_REPORT_ROW,
} from "#documentation_validation/constants";

/** Responsibilities: _group report violations_, _output reporting rendering_. **/
export class TaskReportDocument {
	private readonly documents: TaskWorkspaceDocumentsContract;
	private readonly violation_rows: TaskReportViolationRows;

	/** Responsibilities: _initialization reporting workspace violations_. **/
	public constructor(documents: TaskWorkspaceDocumentsContract, violations: readonly ReportViolation[]) {
		this.documents = documents;
		this.violation_rows = new TaskReportViolationRows(violations);
	}

	/** Responsibilities: _lint reporting markdown rendering_. **/
	public markdown(): string {
		const rows = this.violation_rows.visible_rows();
		const remaining_row = this.violation_rows.remaining_row();
		if (remaining_row.length > 0) {
			rows.push(remaining_row);
		}
		if (rows.length === 0) {
			rows.push(EMPTY_DOCUMENTATION_REPORT_ROW);
		}
		const lines = ["# Lint report", "", DOCUMENTATION_REPORT_HEADER, DOCUMENTATION_REPORT_DIVIDER, ...rows];
		return lines.join("\n");
	}

	/** Responsibilities: _markdown report writing_. **/
	public write(): void {
		this.documents.write_document("report", this.markdown());
	}
}
