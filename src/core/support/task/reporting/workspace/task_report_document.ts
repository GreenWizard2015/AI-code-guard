import { EMPTY_REPORT_MARKDOWN_ROW, REPORT_MARKDOWN_DIVIDER, REPORT_MARKDOWN_HEADER } from "src/constants";
import { TaskFileFixPlan } from "src/core/support/task/reporting/workspace/task_file_fix_plan";
import { TaskReportViolationRows } from "src/core/support/task/reporting/workspace/task_report_violation_rows";
import type { TaskFileSelection } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TaskReportDocumentContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";

/** Responsibilities: _group report violations_, _output reporting rendering_. **/
export class TaskReportDocument implements TaskReportDocumentContract {
	private readonly _documents: TaskWorkspaceDocumentsContract;
	private readonly _violation_rows: TaskReportViolationRows;
	private readonly _file_fix_plan: TaskFileFixPlan;

	/** Responsibilities: _file plan section rendering_. **/
	private render_file_plan(): string[] {
		const lines = ["## File fix plan", ""];
		if (this._file_fix_plan.path_count() === 0) {
			lines.push("No diagnostic paths.");
			return lines;
		}
		lines.push(
			"| Path | Max priority | In-batch rules | Deferred rules | Suppressed diagnostics | Batch status |",
			"| --- | ---: | --- | --- | --- | --- |",
		);
		const rows = this._file_fix_plan.rows();
		for (const row of rows) {
			lines.push(
				`| \`${row.path}\` | ${row.max_priority} | ${row.in_batch_rules} | ${row.deferred_rules} | ${row.suppressed_diagnostics} | ${row.batch_status} |`,
			);
		}
		return lines;
	}

	/** Responsibilities: _remaining diagnostic rendering_. **/
	private render_deferred_diagnostics(): string[] {
		const deferred = this._file_fix_plan.deferred_diagnostics();
		if (deferred.length === 0) {
			return [];
		}
		const lines = ["", "## Deferred diagnostics", ""];
		for (const violation of deferred) {
			lines.push(
				`- \`${violation.file()}:${violation.line()}\` (priority ${violation.priority()}, ${violation.rule_id()}): ${violation.message()}`,
				`  Hint: ${violation.hint()}`,
			);
		}
		return lines;
	}

	/** Responsibilities: _initialization reporting workspace violations_. **/
	public constructor(
		root: string,
		documents: TaskWorkspaceDocumentsContract,
		violations: readonly ViolationContract[],
		selection: TaskFileSelection,
	) {
		this._documents = documents;
		this._violation_rows = new TaskReportViolationRows(selection.violations);
		this._file_fix_plan = new TaskFileFixPlan(root, violations, selection);
	}

	/** Responsibilities: _lint reporting markdown rendering_. **/
	public markdown(): string {
		const rows = this._violation_rows.visible_rows();
		const remaining_row = this._violation_rows.remaining_row();
		if (remaining_row.length > 0) {
			rows.push(remaining_row);
		}
		if (rows.length === 0) {
			rows.push(EMPTY_REPORT_MARKDOWN_ROW);
		}
		const lines = ["# Lint report", "", REPORT_MARKDOWN_HEADER, REPORT_MARKDOWN_DIVIDER, ...rows, ""];
		lines.push(...this.render_file_plan());
		lines.push(...this.render_deferred_diagnostics());
		return lines.join("\n");
	}

	/** Responsibilities: _markdown report writing_. **/
	public write(): void {
		this._documents.write_document("report", this.markdown());
	}
}
