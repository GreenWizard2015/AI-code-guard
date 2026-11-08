import { join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { ReportStatus } from "src/core/support/reporting/report_status";
import { LINT_OUTPUT_DOCUMENT } from "src/core/support/task/constants";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import { TaskBatchReplacement } from "src/core/support/task/reporting/workspace/task_batch_replacement";
import { TaskCleanReport } from "src/core/support/task/reporting/workspace/task_clean_report";
import { TaskFileSelector } from "src/core/support/task/reporting/workspace/task_file_selector";
import { TaskIssueDocument } from "src/core/support/task/reporting/workspace/task_issue_document";
import { TaskReportDocument } from "src/core/support/task/reporting/workspace/task_report_document";
import { TaskWorkspace } from "src/core/support/task/reporting/workspace/task_workspace";
import type { CallableReviewAgentProvider } from "src/core/support/task/reporting/workspace/types";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import { TaskReviewAgentRuntime } from "src/core/support/task/review-agent/task_review_agent_runtime";
import type { IOContract } from "src/io/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TaskBatchReplacementContract,
	TaskCleanReportContract,
	TaskFileSelectorContract,
	TaskIssueDocumentContract,
	TaskReportDocumentContract,
	TaskReportingContract,
	TaskReviewAgentContract,
	TaskReviewContract,
	TaskRuleDocumentationContract,
	TaskWorkspaceContract,
	TaskWorkspaceDocumentsContract,
} from "src/task_protocols";
import type { ReviewAgentSelection, TaskReviewRunResult } from "src/task_review_types";
import type {
	LintTaskPolicy,
	ReviewAgentRunOptions,
	ReviewStatus,
	TaskReportingDependencies,
	TaskReportingOptions,
	TaskWorkspaceDocument,
} from "src/task_types";

/** Responsibilities: _task violations selection_, _output task reporting documents_. **/
export class TaskReporting implements TaskReportingContract {
	private readonly _root: string;
	private readonly _workspace: TaskWorkspaceContract;
	private readonly _workspace_documents: TaskWorkspaceDocumentsContract;
	private readonly _batch_replacement: TaskBatchReplacementContract;
	private readonly _documentation: TaskRuleDocumentationContract;
	private readonly _review: TaskReviewContract;
	private readonly _review_archive: ResolvedReviewArchive;
	private readonly _review_agent: CallableReviewAgentProvider;
	private readonly _file_selector: TaskFileSelectorContract;
	private readonly _clean_report: TaskCleanReportContract;
	private readonly _issue_document: TaskIssueDocumentContract;
	private readonly _file_io: IOContract;

	/** Responsibilities: _diagnostic batch formatting_. **/
	private format_batch(
		selected_violations: readonly ViolationContract[],
		all_violations: readonly ViolationContract[],
		skip_review: boolean,
		report_document: TaskReportDocumentContract,
	): string {
		let output: string;
		const review_files = this._review.files();
		if (all_violations.length === 0) {
			output = this._clean_report.format(skip_review);
		} else {
			const report_status = new ReportStatus(all_violations);
			output = [
				report_status.summary(),
				`See your task in \`${this._workspace_documents.path_for_document("issues")}\`.`,
			].join("\n");
		}
		output = [output, `Report in file \`${this._workspace_documents.path_for_document("report")}\`.`].join("\n");
		const documents = new Map<TaskWorkspaceDocument, string>([
			["report", report_document.markdown()],
			[LINT_OUTPUT_DOCUMENT, output],
		]);
		this._issue_document.write(selected_violations, review_files, documents);
		return output;
	}

	/** Responsibilities: _lazy review-agent construction_. **/
	private create_review_agent(): TaskReviewAgentContract {
		const runtime = new TaskReviewAgentRuntime(this._root, this._file_io);
		const hooks = runtime.hook_configuration();
		return new TaskReviewAgent({
			root: this._root,
			agent_catalog: runtime.catalog(),
			hooks: hooks.hooks,
			hook_command: hooks.command,
			hook_file: hooks.file,
			file_io: this._file_io,
		});
	}

	/** Responsibilities: _task reporting collaborators initialization_. **/
	public constructor(root: string, dependencies: TaskReportingDependencies) {
		this._root = root;
		this._file_io = dependencies.file_io;
		const workspace = new TaskWorkspace(root, this._file_io);
		this._workspace = workspace;
		const workspace_root = join(resolve(root), AI_CODE_GUARD_DIRECTORY);
		this._workspace_documents = workspace;
		this._batch_replacement = new TaskBatchReplacement(
			this._workspace_documents,
			workspace_root,
			join(workspace_root, "rules"),
			this._file_io,
		);
		this._file_selector = new TaskFileSelector(root);
		this._documentation = dependencies.documentation;
		this._review_archive = new ResolvedReviewArchive(root, this._file_io);
		this._review = new TaskReview(root, this._file_io);
		this._clean_report = new TaskCleanReport(this._review);
		this._issue_document = new TaskIssueDocument(
			root,
			this._workspace_documents,
			this._batch_replacement,
			this._documentation,
			this._file_io,
		);
		let get_review_agent = (): TaskReviewAgentContract => {
			const review_agent = this.create_review_agent();
			get_review_agent = () => review_agent;
			return review_agent;
		};
		this._review_agent = () => get_review_agent();
	}

	/** Responsibilities: _violations task options formatting_. **/
	public format(violations: readonly ViolationContract[], options: TaskReportingOptions): string {
		return this.format_with_policy(violations, options.batch_size, options.policy, options.skip_review);
	}

	/** Responsibilities: _architecture review state aggregation_. **/
	public review_status(): ReviewStatus {
		return {
			required: false,
			active: this._review.files().length > 0,
			completed: this._review.completed(),
			failed: false,
		};
	}

	/** Responsibilities: _architecture review agent execution_. **/
	public run_review_agent(
		selection: ReviewAgentSelection,
		options: ReviewAgentRunOptions,
	): Promise<TaskReviewRunResult> {
		this._workspace.prepare_review();
		return this._review_agent().run_parallel(selection, options);
	}

	/** Responsibilities: _violations by policy selection_, _task documents writing_. **/
	public format_with_policy(
		violations: readonly ViolationContract[],
		batch_size: number,
		policy: LintTaskPolicy,
		skip_review: boolean,
	): string {
		this._review_archive.archive_resolved_reviews();
		this._documentation.validate_rule_documents();
		let batch = this._file_selector.select_top_category(violations, batch_size);
		if (policy === "all") {
			batch = this._file_selector.select_all(violations, batch_size);
		}
		return this.format_batch(
			batch.violations,
			violations,
			skip_review,
			new TaskReportDocument(this._root, this._workspace_documents, violations, batch),
		);
	}
}
