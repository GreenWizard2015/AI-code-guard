import { join } from "node:path";
import { TASK_PUBLICATION_JOURNAL_COMMITTED, TASK_PUBLICATION_JOURNAL_PREPARED } from "src/core/support/task/constants";
import type {
	TaskPublicationTransactionContract,
	TaskPublicationTransactionOptions,
	TaskPublicationTransactionPathContract,
} from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _publication transaction ownership_, _journal lifecycle_. **/
export class TaskPublicationTransaction implements TaskPublicationTransactionContract {
	private readonly _lock_path: string;
	private readonly _owner_token: string;
	private readonly _process_identity: string;
	private readonly _file_io: IOContract;
	private readonly _path: TaskPublicationTransactionPathContract;

	/** Responsibilities: _atomic journal replacement_. **/
	private write_atomically(path: string, content: string): void {
		const temporary_path = `${path}.next`;
		try {
			this._file_io.file(temporary_path).write_text(content);
			this._file_io.move_path(temporary_path, path);
		} catch (error) {
			this._file_io.remove_path(temporary_path);
			throw error;
		}
	}

	/** Responsibilities: _publication transaction state initialization_. **/
	public constructor(options: TaskPublicationTransactionOptions) {
		this._lock_path = options.lock_path;
		this._owner_token = options.owner_token;
		this._process_identity = options.process_identity;
		this._path = options.path;
		this._file_io = options.file_io;
	}

	/** Responsibilities: _publication transaction ownership_. **/
	public begin(): void {
		this._path.validate();
		const owner_path = join(this._lock_path, "owner");
		const [, start_time = "", boot_id = ""] = this._process_identity.split("\n");
		this.write_atomically(
			owner_path,
			`${process.pid}\n${this._path.value()}\n${this._owner_token}\n${start_time}\n${boot_id}\n`,
		);
	}

	/** Responsibilities: _publication journal preparation_. **/
	public write_journal(rules_existed: boolean, documents: ReadonlySet<TaskWorkspaceDocument>): void {
		this._path.validate();
		const journal_path = join(this._path.value(), "journal");
		const lines = [TASK_PUBLICATION_JOURNAL_PREPARED, `${rules_existed ? "1" : "0"}`, ...documents];
		this._file_io.file(journal_path).write_text(lines.join("\n"));
	}

	/** Responsibilities: _publication journal commit_. **/
	public commit(): void {
		this._path.validate();
		const journal_path = join(this._path.value(), "journal");
		const lines = this._file_io.file(journal_path).file_text().split("\n");
		lines[0] = TASK_PUBLICATION_JOURNAL_COMMITTED;
		this.write_atomically(journal_path, lines.join("\n"));
	}
}
