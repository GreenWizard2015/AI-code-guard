import { dirname, join } from "node:path";
import { LINT_OUTPUT_DOCUMENT, TASK_PUBLICATION_LOCK_DIRECTORY } from "src/core/support/task/constants";
import { TaskPublicationJournal } from "src/core/support/task/publication/task_publication_journal";
import { TaskPublicationJournalFile } from "src/core/support/task/publication/task_publication_journal_file";
import { TaskPublicationOwner } from "src/core/support/task/publication/task_publication_owner";
import { TaskPublicationRollback } from "src/core/support/task/publication/task_publication_rollback";
import { TaskPublicationTransactionPath } from "src/core/support/task/publication/task_publication_transaction_path";
import type {
	TaskPublicationJournalContract,
	TaskPublicationOwnerContract,
	TaskPublicationRecoveryContract,
	TaskPublicationRollbackContract,
	TaskPublicationTransactionPathContract,
} from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _task publication rollback_, _workspace document restoration_. **/
export class TaskPublicationRecovery implements TaskPublicationRecoveryContract {
	private readonly _documents: TaskWorkspaceDocumentsContract;
	private readonly _rules_root: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _publication lock ownership verification_. **/
	private verify_lock_owner(owner_path: string, expected_owner: TaskPublicationOwnerContract): void {
		if (!this._file_io.path_is_file(owner_path)) {
			throw new Error(`Task publication lock owner changed during recovery: ${owner_path}`);
		}
		const [pid_text, transaction_text = "", token = ""] = this._file_io.file(owner_path).file_text().split("\n");
		const current_owner = new TaskPublicationOwner(
			Number(pid_text),
			transaction_text.trim(),
			token.trim(),
			"",
			this._file_io,
		);
		const same_token = expected_owner.same_token(current_owner);
		const same_transaction = expected_owner.abandoned_transaction() === current_owner.abandoned_transaction();
		if (!same_token || !same_transaction) {
			throw new Error(`Task publication lock owner changed during recovery: ${owner_path}`);
		}
	}

	/** Responsibilities: _journal-directed transaction recovery_. **/
	private recover_journal(
		owner: TaskPublicationOwnerContract,
		journal: TaskPublicationJournalContract,
		transaction: TaskPublicationTransactionPathContract,
	): void {
		transaction.validate();
		if (!journal.valid()) {
			throw new Error(`Task publication transaction journal is unavailable: ${transaction.value()}`);
		}
		const owner_path = join(dirname(this._rules_root), TASK_PUBLICATION_LOCK_DIRECTORY, "owner");
		this.verify_lock_owner(owner_path, owner);
		if (journal.committed()) {
			this._file_io.remove_path(transaction.value());
			return;
		}
		this.for_transaction(transaction.value()).restore(journal.rules_to_restore(), new Set(journal.prior_documents()));
	}

	/** Responsibilities: _task rollback dependencies_. **/
	public constructor(documents: TaskWorkspaceDocumentsContract, rules_root: string, file_io: IOContract) {
		this._documents = documents;
		this._file_io = file_io;
		this._rules_root = rules_root;
	}

	/** Responsibilities: _transaction rollback scope_. **/
	public for_transaction(transaction: string): TaskPublicationRollbackContract {
		const path = new TaskPublicationTransactionPath(transaction, dirname(dirname(this._rules_root)), this._file_io);
		path.validate();
		return new TaskPublicationRollback(this._documents, this._rules_root, path, this._file_io);
	}

	/** Responsibilities: _existing task documents_. **/
	public existing_documents(): ReadonlySet<TaskWorkspaceDocument> {
		const existing = new Set<TaskWorkspaceDocument>();
		for (const document of ["issues", "report", LINT_OUTPUT_DOCUMENT] as const) {
			if (this._file_io.path_is_file(this._documents.path_for_document(document))) {
				existing.add(document);
			}
		}
		return existing;
	}

	/** Responsibilities: _abandoned publication transaction recovery_. **/
	public recover_abandoned_transaction(owner: TaskPublicationOwnerContract): void {
		const transaction = owner.abandoned_transaction();
		if (transaction.length === 0) {
			return;
		}
		const transaction_path = new TaskPublicationTransactionPath(
			transaction,
			dirname(dirname(this._rules_root)),
			this._file_io,
		);
		transaction_path.validate();
		if (!this._file_io.file(transaction_path.value()).path_exists()) {
			return;
		}
		const journal_path = join(transaction_path.value(), "journal");
		const journal_file = new TaskPublicationJournalFile(journal_path, this._file_io);
		const journal = new TaskPublicationJournal(journal_file.state());
		this.recover_journal(owner, journal, transaction_path);
	}
}
