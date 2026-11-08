import { basename, dirname, join, resolve } from "node:path";
import { TASK_PUBLICATION_TRANSACTION_PREFIX } from "src/core/support/task/constants";
import type { TaskPublicationTransactionPathContract } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _path normalization_, _path ownership validation_. **/
export class TaskPublicationTransactionPath implements TaskPublicationTransactionPathContract {
	private readonly _path: string;
	private readonly _parent: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _transaction path shape validation_. **/
	private valid_name(name: string): boolean {
		const parent_matches = dirname(this._path) === this._parent;
		const prefix_matches = name.startsWith(TASK_PUBLICATION_TRANSACTION_PREFIX);
		const suffix_is_safe = /^[A-Za-z0-9_-]+$/.test(name.slice(TASK_PUBLICATION_TRANSACTION_PREFIX.length));
		if (!parent_matches) {
			return false;
		}
		if (!prefix_matches) {
			return false;
		}
		return suffix_is_safe;
	}

	/** Responsibilities: _transaction parent path validation_. **/
	private safe_parent(): boolean {
		const expected_real_parent = this._file_io.file(this._parent).real_path();
		const actual_real_parent = this._file_io.file(dirname(this._path)).real_path();
		if (actual_real_parent !== expected_real_parent) {
			return false;
		}
		return !this._file_io.file(this._path).symbolic_link();
	}

	/** Responsibilities: _transaction real path validation_. **/
	private safe_path(name: string): boolean {
		const transaction = this._file_io.file(this._path);
		if (!transaction.path_exists()) {
			return true;
		}
		const expected_real_path = join(this._file_io.file(this._parent).real_path(), name);
		return transaction.real_path() === expected_real_path;
	}

	/** Responsibilities: _transaction path initialization_. **/
	public constructor(path: string, parent: string, file_io: IOContract) {
		this._path = resolve(path);
		this._parent = resolve(parent);
		this._file_io = file_io;
	}

	/** Responsibilities: _transaction path access_. **/
	public value(): string {
		return this._path;
	}

	/** Responsibilities: _transaction path ownership verification_. **/
	public validate(): void {
		const name = basename(this._path);
		if (!this.valid_name(name)) {
			throw new Error(`Task publication transaction is outside the workspace: ${this._path}`);
		}
		if (!this.safe_parent()) {
			throw new Error(`Task publication transaction is outside the workspace: ${this._path}`);
		}
		if (!this.safe_path(name)) {
			throw new Error(`Task publication transaction is outside the workspace: ${this._path}`);
		}
	}
}
