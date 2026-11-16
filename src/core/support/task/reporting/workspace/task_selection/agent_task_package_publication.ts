import { join } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import { AgentPackageAssignmentStore } from "src/core/support/task/reporting/workspace/task_selection/agent_package_assignment_store";
import { AgentPackagePlanIntegrity } from "src/core/support/task/reporting/workspace/task_selection/agent_package_plan_integrity";
import { AgentPackagePlanner } from "src/core/support/task/reporting/workspace/task_selection/agent_package_planner";
import { AgentTaskPackageMarkdown } from "src/core/support/task/reporting/workspace/task_selection/agent_task_package_markdown";
import {
	AGENT_PACKAGE_TASKS_DIRECTORY_NAME,
	AGENT_TASK_PACKAGE_PREVIOUS_DIRECTORY_NAME,
	AGENT_TASK_PACKAGE_STAGING_DIRECTORY_NAME,
	AGENT_TASK_PACKAGE_SUMMARY_FILE_NAME,
	AGENT_TASK_PACKAGE_TRANSACTION_PREFIX,
} from "src/core/support/task/reporting/workspace/task_selection/constants";
import type { IOContract } from "src/io/protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	AgentPackageAssignmentStoreContract,
	AgentPackagePlan,
	AgentPackagePublicationData,
	AgentPackagePublicationRequest,
	AgentTaskPackageMarkdownContract,
	AgentTaskPackagePublicationContract,
} from "src/task_selection_types";
import type { TestTargetLink } from "src/task_types";

/** Responsibilities: _package planning_, _atomic publication_. **/
export class AgentTaskPackagePublication implements AgentTaskPackagePublicationContract {
	private readonly _root: string;
	private readonly _file_io: IOContract;
	private readonly _markdown: AgentTaskPackageMarkdownContract;
	private readonly _assignment_store: AgentPackageAssignmentStoreContract;

	/** Responsibilities: _package staging_. **/
	private write_staging(staging_directory: string, data: AgentPackagePublicationData): void {
		const { plan, snapshot_id, request } = data;
		this._file_io.create_directory(staging_directory);
		for (const agent_package of plan.packages) {
			const package_name = `agent-${String(agent_package.number).padStart(2, "0")}.md`;
			this._file_io
				.file(join(staging_directory, package_name))
				.write_text(this._markdown.package_markdown(agent_package, snapshot_id));
		}
		const summary = this._markdown.summary_markdown({
			plan,
			snapshot_id,
			selected_findings: request.selected_findings.length,
			deferred_findings: request.deferred_findings,
			suppressed_findings: request.suppressed_findings,
		});
		this._file_io.file(join(staging_directory, AGENT_TASK_PACKAGE_SUMMARY_FILE_NAME)).write_text(summary);
		this._assignment_store.write_manifest(staging_directory, plan);
	}

	/** Responsibilities: _package rollback_. **/
	private restore_previous(destination: string, previous: string, transaction: string): void {
		if (this._file_io.file(destination).path_exists()) {
			this._file_io.remove_path(destination);
		}
		if (this._file_io.file(previous).path_exists()) {
			this._file_io.move_path(previous, destination);
		}
		this._file_io.remove_path(transaction);
	}

	/** Responsibilities: _publication transaction_. **/
	private publish_staging(
		staging: string,
		destination: string,
		previous: string,
		transaction: string,
		data: AgentPackagePublicationData,
	): void {
		let previous_moved = false;
		let published = false;
		try {
			this.write_staging(staging, data);
			if (this._file_io.file(destination).path_exists()) {
				this._file_io.move_path(destination, previous);
				previous_moved = true;
			}
			this._file_io.move_path(staging, destination);
			published = true;
		} finally {
			if (!published && previous_moved) {
				this.restore_previous(destination, previous, transaction);
			} else {
				this._file_io.remove_path(transaction);
			}
		}
	}

	/** Responsibilities: _package plan validation_. **/
	private validated_plan(
		selected_findings: readonly ViolationContract[],
		test_target_links: readonly TestTargetLink[],
		package_count: number,
		batch_size: number,
	): AgentPackagePlan {
		const previous_assignments = this._assignment_store.previous_assignments();
		const planner = new AgentPackagePlanner(this._root, previous_assignments);
		const plan = planner.plan(selected_findings, test_target_links, package_count, batch_size);
		const validator = new AgentPackagePlanIntegrity(this._root);
		validator.validate(plan, selected_findings);
		return plan;
	}

	/** Responsibilities: _publication setup_. **/
	public constructor(root: string, file_io: IOContract) {
		this._root = root;
		this._file_io = file_io;
		this._markdown = new AgentTaskPackageMarkdown();
		this._assignment_store = new AgentPackageAssignmentStore(root, file_io);
	}

	/** Responsibilities: _package publication_. **/
	public publish(request: AgentPackagePublicationRequest): AgentPackagePlan {
		const plan = this.validated_plan(
			request.selected_findings,
			request.test_target_links,
			request.package_count,
			request.batch_size,
		);
		const workspace = join(this._root, AI_CODE_GUARD_DIRECTORY);
		const destination = join(workspace, AGENT_PACKAGE_TASKS_DIRECTORY_NAME);
		this._file_io.create_directory(workspace);
		const transaction = this._file_io.temporary_directory(workspace, AGENT_TASK_PACKAGE_TRANSACTION_PREFIX);
		const staging = join(transaction, AGENT_TASK_PACKAGE_STAGING_DIRECTORY_NAME);
		const previous = join(transaction, AGENT_TASK_PACKAGE_PREVIOUS_DIRECTORY_NAME);
		const snapshot_id = this._markdown.snapshot_id(request.snapshot_findings);
		this.publish_staging(staging, destination, previous, transaction, { plan, snapshot_id, request });
		return plan;
	}
}
