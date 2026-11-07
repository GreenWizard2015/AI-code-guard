import { join } from "node:path";
import {
	ISSUES_DOCUMENT_NAME,
	LINT_OUTPUT_DOCUMENT,
	LINT_OUTPUT_DOCUMENT_NAME,
	REPORT_DOCUMENT_NAME,
} from "src/core/support/task/constants";
import type { TaskPublicationRollbackContract } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _transaction backup restoration_, _rollback path ownership_. **/
export class TaskPublicationRollback implements TaskPublicationRollbackContract {
	private readonly _documents: TaskWorkspaceDocumentsContract;
	private readonly _rules_root: string;
	private readonly _transaction: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _task rules restoration_. **/
	private restore_rules(rules_existed: boolean): void {
		const backup_rules = join(this._transaction, "rules");
		if (this._file_io.file(backup_rules).path_exists()) {
			this._file_io.remove_path(this._rules_root);
			this._file_io.move_path(backup_rules, this._rules_root);
		} else if (!rules_existed) {
			this._file_io.remove_path(this._rules_root);
		}
	}

	/** Responsibilities: _task document restoration_. **/
	private restore_documents(existing_documents: ReadonlySet<TaskWorkspaceDocument>): void {
		for (const [document, backup] of this.backup_documents()) {
			const current = this._documents.path_for_document(document);
			if (this._file_io.file(backup).path_exists()) {
				this._file_io.remove_path(current);
				this._file_io.move_path(backup, current);
			} else if (!existing_documents.has(document)) {
				this._file_io.remove_path(current);
			}
		}
	}

	/** Responsibilities: _rollback transaction initialization_. **/
	public constructor(
		documents: TaskWorkspaceDocumentsContract,
		rules_root: string,
		transaction: string,
		file_io: IOContract,
	) {
		this._documents = documents;
		this._rules_root = rules_root;
		this._transaction = transaction;
		this._file_io = file_io;
	}

	/** Responsibilities: _transaction backup document paths_. **/
	public backup_documents(): Map<TaskWorkspaceDocument, string> {
		return new Map<TaskWorkspaceDocument, string>([
			["issues", join(this._transaction, ISSUES_DOCUMENT_NAME)],
			["report", join(this._transaction, REPORT_DOCUMENT_NAME)],
			[LINT_OUTPUT_DOCUMENT, join(this._transaction, LINT_OUTPUT_DOCUMENT_NAME)],
		]);
	}

	/** Responsibilities: _task state restoration_. **/
	public restore(rules_existed: boolean, existing_documents: ReadonlySet<TaskWorkspaceDocument>): void {
		this.restore_rules(rules_existed);
		this.restore_documents(existing_documents);
		this._file_io.remove_path(this._transaction);
	}
}
