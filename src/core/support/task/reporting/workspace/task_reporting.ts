import { join, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY, POLICY_TOP_CATEGORY } from "src/constants";
import { INVALID_AGENT_BATCH_SIZE_MESSAGE, MINIMUM_AGENT_BATCH_SIZE } from "src/core/constants";
import { ReportStatus } from "src/core/support/reporting/report_status";
import { LINT_OUTPUT_DOCUMENT } from "src/core/support/task/constants";
import { TaskBatchReplacement } from "src/core/support/task/reporting/workspace/task_batch_replacement";
import { TaskIssueDocument } from "src/core/support/task/reporting/workspace/task_issue_document";
import { TaskReportDocument } from "src/core/support/task/reporting/workspace/task_report_document";
import { TaskReportingReviewState } from "src/core/support/task/reporting/workspace/task_reporting_review_state";
import { AgentTaskPackagePublication } from "src/core/support/task/reporting/workspace/task_selection/agent_task_package_publication";
import { AGENT_PACKAGE_TASKS_DIRECTORY_NAME } from "src/core/support/task/reporting/workspace/task_selection/constants";
import { TaskFileSelector } from "src/core/support/task/reporting/workspace/task_selection/task_file_selector";
import { TaskWorkspace } from "src/core/task_workspace";
import type { IOContract } from "src/io/protocols";
import type { TaskFileSelection } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TaskBatchReplacementContract,
	TaskFileSelectorContract,
	TaskIssueDocumentContract,
	TaskReportingContract,
	TaskReportingReviewStateContract,
	TaskRuleDocumentationContract,
	TaskWorkspaceDocumentsContract,
} from "src/task_protocols";
import type { AgentPackagePublicationRequest, TaskFileSelectionRequest } from "src/task_selection_types";
import type {
	AgentPackagePublicationContext,
	AgentPackageReportContext,
	AgentPackageReportingRequest,
	AgentPackageTaskReportingOptions,
	TaskReportingBatchContext,
	TaskReportingDependencies,
	TaskReportingOptions,
	TaskWorkspaceDocument,
} from "src/task_types";
import { ALL_POLICY } from "src/task_types";

/** Responsibilities: _task violations selection_, _output task reporting documents_. **/
export class TaskReporting implements TaskReportingContract {
	private readonly _root: string;
	private readonly _file_io: IOContract;
	private readonly _review_state: TaskReportingReviewStateContract;
	private readonly _workspace_documents: TaskWorkspaceDocumentsContract;
	private readonly _batch_replacement: TaskBatchReplacementContract;
	private readonly _documentation: TaskRuleDocumentationContract;
	private readonly _file_selector: TaskFileSelectorContract;
	private readonly _agent_packages: AgentTaskPackagePublication;
	private readonly _issue_document: TaskIssueDocumentContract;

	/** Responsibilities: _diagnostic batch formatting_. **/
	private format_batch(context: TaskReportingBatchContext): string {
		const { selected_violations, all_violations, report_document, review_preparation, extra_output } = context;
		const review_files = review_preparation.review_files;
		const output = this.batch_output(all_violations, review_preparation.clean_report, extra_output);
		const documents = new Map<TaskWorkspaceDocument, string>([
			["report", report_document.markdown()],
			[LINT_OUTPUT_DOCUMENT, output],
		]);
		this._issue_document.write(selected_violations, review_files, documents);
		return output;
	}

	/** Responsibilities: _batch report text_. **/
	private batch_output(
		all_violations: readonly ViolationContract[],
		clean_report: string,
		extra_output: string,
	): string {
		let output = clean_report;
		if (all_violations.length > 0) {
			const report_status = new ReportStatus(all_violations);
			output = [
				report_status.summary(),
				`See your task in \`${this._workspace_documents.path_for_document("issues")}\`.`,
			].join("\n");
		}
		output = [output, `Report in file \`${this._workspace_documents.path_for_document("report")}\`.`].join("\n");
		if (extra_output.length > 0) {
			output = [output, extra_output].join("\n");
		}
		return output;
	}

	/** Responsibilities: _agent batch size validation_. **/
	private validate_agent_options(options: TaskReportingOptions): void {
		if (options.batch_size < MINIMUM_AGENT_BATCH_SIZE) {
			throw new Error(INVALID_AGENT_BATCH_SIZE_MESSAGE);
		}
	}

	/** Responsibilities: _agent package count message_. **/
	private package_message(package_count: number): string {
		if (package_count === 0) {
			return "No agent packages were created.";
		}
		let package_word = "packages";
		if (package_count === 1) {
			package_word = "package";
		}
		return `Created ${package_count} agent ${package_word} in ${AI_CODE_GUARD_DIRECTORY}/${AGENT_PACKAGE_TASKS_DIRECTORY_NAME}/summary.md.`;
	}

	/** Responsibilities: _agent package report construction_. **/
	private agent_package_report(context: AgentPackageReportContext): string {
		const { request, review_preparation } = context;
		this.validate_agent_options(request.options);
		let selection_request: TaskFileSelectionRequest = {
			violations: request.violations,
			mode: POLICY_TOP_CATEGORY,
			batch_size: request.violations.length,
		};
		if (request.options.policy === ALL_POLICY) {
			selection_request = {
				violations: request.violations,
				mode: "all",
				batch_size: request.violations.length,
			};
		}
		const selection = this._file_selector.select(selection_request);
		return this.publish_package_report({ request, selection, review_preparation });
	}

	/** Responsibilities: _agent package publication_, _agent report rendering_. **/
	private publish_package_report(context: AgentPackagePublicationContext): string {
		const { request, selection, review_preparation } = context;
		const suppressed_findings = selection.visibility.suppressed.length;
		const publication = this.agent_package_publication(request, selection, suppressed_findings);
		const plan = this._agent_packages.publish(publication);
		const report_document = new TaskReportDocument(
			this._root,
			this._workspace_documents,
			request.violations,
			selection,
		);
		const batch_context: TaskReportingBatchContext = {
			selected_violations: selection.violations,
			all_violations: request.violations,
			report_document,
			review_preparation,
			extra_output: this.package_message(plan.packages.length),
		};
		return this.format_batch(batch_context);
	}

	/** Responsibilities: _agent package publication request_. **/
	private agent_package_publication(
		request: AgentPackageReportingRequest,
		selection: TaskFileSelection,
		suppressed_findings: number,
	): AgentPackagePublicationRequest {
		return {
			selected_findings: selection.violations,
			snapshot_findings: request.violations,
			test_target_links: request.options.agent_mode.test_target_links,
			package_count: request.options.agent_mode.package_count,
			batch_size: request.options.batch_size,
			deferred_findings: Math.max(0, request.violations.length - selection.violations.length - suppressed_findings),
			suppressed_findings,
		};
	}

	/** Responsibilities: _task reporting collaborators initialization_. **/
	public constructor(root: string, dependencies: TaskReportingDependencies) {
		this._root = resolve(root);
		this._file_io = dependencies.file_io;
		this._review_state = new TaskReportingReviewState(this._root, this._file_io);
		const workspace_root = join(this._root, AI_CODE_GUARD_DIRECTORY);
		this._workspace_documents = new TaskWorkspace(this._root, this._file_io);
		this._batch_replacement = new TaskBatchReplacement(
			this._workspace_documents,
			workspace_root,
			join(workspace_root, "rules"),
			this._file_io,
		);
		this._file_selector = new TaskFileSelector(this._root);
		this._agent_packages = new AgentTaskPackagePublication(this._root, this._file_io);
		this._documentation = dependencies.documentation;
		this._issue_document = new TaskIssueDocument(
			this._root,
			this._workspace_documents,
			this._batch_replacement,
			this._documentation,
			this._file_io,
		);
	}

	/** Responsibilities: _review lifecycle state_. **/
	public review_operations(): TaskReportingReviewStateContract {
		return this._review_state;
	}

	/** Responsibilities: _task report formatting_. **/
	public format(violations: readonly ViolationContract[], options: TaskReportingOptions): string {
		const review_preparation = this._review_state.prepare_report(options.skip_review);
		this._documentation.validate_rule_documents();
		let selection_request: TaskFileSelectionRequest = {
			violations,
			mode: POLICY_TOP_CATEGORY,
			batch_size: options.batch_size,
		};
		if (options.policy === ALL_POLICY) {
			selection_request = { violations, mode: ALL_POLICY, batch_size: options.batch_size };
		}
		const batch = this._file_selector.select(selection_request);
		const report_document = new TaskReportDocument(this._root, this._workspace_documents, violations, batch);
		const batch_context: TaskReportingBatchContext = {
			selected_violations: batch.violations,
			all_violations: violations,
			report_document,
			review_preparation,
			extra_output: "",
		};
		return this.format_batch(batch_context);
	}

	/** Responsibilities: _agent package report formatting_. **/
	public format_agent_packages(
		violations: readonly ViolationContract[],
		options: AgentPackageTaskReportingOptions,
	): string {
		const review_preparation = this._review_state.prepare_report(options.skip_review);
		this._documentation.validate_rule_documents();
		const request = { violations, options };
		return this.agent_package_report({ request, review_preparation });
	}
}
