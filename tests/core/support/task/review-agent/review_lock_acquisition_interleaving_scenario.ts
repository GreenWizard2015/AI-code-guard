import { join } from "node:path";
import type { FileEntry, FileResourceContract, IOContract } from "src/io/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { CallableInterleaving } from "tests/core/types";

/** Responsibilities: _stale lock setup_, _recovery claim observation_. **/
export class ReviewLockAcquisitionInterleavingScenario implements IOContract {
	private readonly _memory: InMemoryFileIO;
	private readonly _lock_path: string;
	private readonly _recovery_claim_observers: CallableInterleaving[];
	private _recovery_claim_published: boolean;

	/** Responsibilities: _interleaving fixture setup_. **/
	public constructor(root: string) {
		this._memory = new InMemoryFileIO();
		this._lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		this._recovery_claim_observers = [];
		this._recovery_claim_published = false;
		this._memory.create_directory(this._lock_path);
		this._memory.file(join(this._lock_path, "owner")).write_text("999999999\nstale-owner\n");
	}

	/** Responsibilities: _recovery claim observer registration_. **/
	public observe_recovery_claim(observer: CallableInterleaving): void {
		this._recovery_claim_observers.push(observer);
	}

	/** Responsibilities: _recovery claim event observation_. **/
	public recovery_claim_published(): boolean {
		return this._recovery_claim_published;
	}

	/** Responsibilities: _path-bound file access_. **/
	public file(path: string): FileResourceContract {
		return this._memory.file(path);
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

	/** Responsibilities: _staging directory creation_. **/
	public create_directory_exclusive(directory: string): void {
		this._memory.create_directory_exclusive(directory);
	}

	/** Responsibilities: _path movement_, _recovery claim publication observation_. **/
	public move_path(source: string, destination: string): void {
		this._memory.move_path(source, destination);
		if (destination === `${this._lock_path}.recovery`) {
			this._recovery_claim_published = true;
			for (const observer of this._recovery_claim_observers) {
				observer();
			}
		}
	}

	/** Responsibilities: _temporary directory allocation_. **/
	public temporary_directory(parent: string, prefix: string): string {
		return this._memory.temporary_directory(parent, prefix);
	}

	/** Responsibilities: _path removal_. **/
	public remove_path(path: string): void {
		this._memory.remove_path(path);
	}
}
