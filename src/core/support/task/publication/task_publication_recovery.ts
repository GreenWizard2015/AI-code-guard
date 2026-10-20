import { join } from "node:path";
import {
	ISSUES_DOCUMENT_NAME,
	LINT_OUTPUT_DOCUMENT,
	LINT_OUTPUT_DOCUMENT_NAME,
	REPORT_DOCUMENT_NAME,
} from "src/core/support/task/constants";
import type { TaskPublicationRecoveryContract } from "src/core/support/task/types";
import type { TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _task publication rollback_, _workspace document restoration_. **/
export class TaskPublicationRecovery implements TaskPublicationRecoveryContract {
	private readonly documents: TaskWorkspaceDocumentsContract;
	private readonly rules_root: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _task rules restoration_. **/
	private restore_rules(transaction: string, rules_existed: boolean): void {
		const backup_rules = join(transaction, "rules");
		if (this.file_io.file_paths.path_exists(backup_rules)) {
			this.file_io.directory_operations.remove_path(this.rules_root);
			this.file_io.directory_operations.move_path(backup_rules, this.rules_root);
		} else if (!rules_existed) {
			this.file_io.directory_operations.remove_path(this.rules_root);
		}
	}

	/** Responsibilities: _task document restoration_. **/
	private restore_documents(transaction: string, existing_documents: ReadonlySet<TaskWorkspaceDocument>): void {
		for (const [document, backup] of this.backup_documents(transaction)) {
			const current = this.documents.path_for_document(document);
			if (this.file_io.file_paths.path_exists(backup)) {
				this.file_io.directory_operations.remove_path(current);
				this.file_io.directory_operations.move_path(backup, current);
			} else if (!existing_documents.has(document)) {
				this.file_io.directory_operations.remove_path(current);
			}
		}
	}

	/** Responsibilities: _task rollback dependencies_. **/
	public constructor(documents: TaskWorkspaceDocumentsContract, rules_root: string, file_io: IOContract) {
		this.documents = documents;
		this.rules_root = rules_root;
		this.file_io = file_io;
	}

	/** Responsibilities: _task backup document paths_. **/
	public backup_documents(transaction: string): Map<TaskWorkspaceDocument, string> {
		return new Map<TaskWorkspaceDocument, string>([
			["issues", join(transaction, ISSUES_DOCUMENT_NAME)],
			["report", join(transaction, REPORT_DOCUMENT_NAME)],
			[LINT_OUTPUT_DOCUMENT, join(transaction, LINT_OUTPUT_DOCUMENT_NAME)],
		]);
	}

	/** Responsibilities: _existing task documents_. **/
	public existing_documents(): ReadonlySet<TaskWorkspaceDocument> {
		const existing = new Set<TaskWorkspaceDocument>();
		for (const document of ["issues", "report", LINT_OUTPUT_DOCUMENT] as const) {
			if (this.file_io.directory_entries.path_is_file(this.documents.path_for_document(document))) {
				existing.add(document);
			}
		}
		return existing;
	}

	/** Responsibilities: _task state restoration_. **/
	public restore(
		transaction: string,
		rules_existed: boolean,
		existing_documents: ReadonlySet<TaskWorkspaceDocument>,
	): void {
		this.restore_rules(transaction, rules_existed);
		this.restore_documents(transaction, existing_documents);
		this.file_io.directory_operations.remove_path(transaction);
	}
}
