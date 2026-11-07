import { basename, resolve } from "node:path";
import type { FileEntry, FileResourceContract, IOContract } from "src/io/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskPublicationFaultFileResource } from "tests/bridge/ts/core/support/task-publication-fault-file-resource";

/** Responsibilities: _publication fault injection_, _transaction tracking_. **/
export class TaskPublicationFaultIO implements IOContract {
	private readonly _memory: InMemoryFileIO;
	private readonly _allocated_transactions: string[];
	private _latest_transaction: string;
	private _fail_journal_initialization: boolean;
	private _fail_transaction_cleanup: boolean;
	private _fail_transaction_allocation: boolean;

	/** Responsibilities: _fault fixture initialization_. **/
	public constructor() {
		this._memory = new InMemoryFileIO();
		this._allocated_transactions = [];
		this._latest_transaction = "";
		this._fail_journal_initialization = false;
		this._fail_transaction_cleanup = false;
		this._fail_transaction_allocation = false;
	}

	/** Responsibilities: _journal failure setup_. **/
	public fail_next_journal_initialization(): void {
		this._fail_journal_initialization = true;
	}

	/** Responsibilities: _cleanup failure setup_. **/
	public fail_next_transaction_cleanup(): void {
		this._fail_transaction_cleanup = true;
	}

	/** Responsibilities: _transaction allocation failure setup_. **/
	public fail_next_transaction_allocation(): void {
		this._fail_transaction_allocation = true;
	}

	/** Responsibilities: _transaction allocation history_. **/
	public allocated_transactions(): readonly string[] {
		return [...this._allocated_transactions];
	}

	/** Responsibilities: _latest transaction path_. **/
	public latest_transaction(): string {
		return this._latest_transaction;
	}

	/** Responsibilities: _virtual file population_. **/
	public seed_files(files: ReadonlyMap<string, string>): void {
		this._memory.seed_files(files);
	}

	/** Responsibilities: _journal fault handling_. **/
	public write_file(path: string, content: string): void {
		if (this._fail_journal_initialization && basename(path) === "journal") {
			this._fail_journal_initialization = false;
			this._memory.file(path).write_text("partial journal\n");
			throw new Error("injected journal initialization failure");
		}
		this._memory.file(path).write_text(content);
	}

	/** Responsibilities: _fault-aware file access_. **/
	public file(path: string): FileResourceContract {
		const resource = this._memory.file(path);
		return new TaskPublicationFaultFileResource(resource, path, this);
	}

	/** Responsibilities: _file path inspection_. **/
	public path_is_file(path: string): boolean {
		return this._memory.path_is_file(path);
	}

	/** Responsibilities: _directory path inspection_. **/
	public path_is_directory(path: string): boolean {
		return this._memory.path_is_directory(path);
	}

	/** Responsibilities: _file inventory_. **/
	public list_files(directory: string): readonly string[] {
		return this._memory.list_files(directory);
	}

	/** Responsibilities: _directory entry inventory_. **/
	public list_entries(directory: string): readonly FileEntry[] {
		return this._memory.list_entries(directory);
	}

	/** Responsibilities: _directory creation_. **/
	public create_directory(directory: string): void {
		this._memory.create_directory(directory);
	}

	/** Responsibilities: _exclusive directory creation_. **/
	public create_directory_exclusive(directory: string): void {
		this._memory.create_directory_exclusive(directory);
	}

	/** Responsibilities: _path movement_. **/
	public move_path(source: string, destination: string): void {
		this._memory.move_path(source, destination);
	}

	/** Responsibilities: _transaction allocation_. **/
	public temporary_directory(parent: string, prefix: string): string {
		if (this._fail_transaction_allocation) {
			this._fail_transaction_allocation = false;
			throw new Error("ENOENT: injected transaction directory creation failure");
		}
		const path = this._memory.temporary_directory(parent, prefix);
		this._allocated_transactions.push(path);
		this._latest_transaction = path;
		return path;
	}

	/** Responsibilities: _path removal_. **/
	public remove_path(path: string): void {
		if (this._fail_transaction_cleanup && this._allocated_transactions.includes(resolve(path))) {
			this._fail_transaction_cleanup = false;
			throw new Error("EACCES: injected transaction cleanup failure");
		}
		this._memory.remove_path(path);
	}
}
