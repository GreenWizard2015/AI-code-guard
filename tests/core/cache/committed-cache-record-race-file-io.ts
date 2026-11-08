import { dirname, resolve } from "node:path";
import type { FileEntry } from "src/io/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _inventory interleaving_, _removal error injection_. **/
export class CommittedCacheRecordRaceFileIO extends InMemoryFileIO {
	private _record_path = "";
	private readonly _removal_error: Error;
	private _inventory_captured = false;

	/** Responsibilities: _race error initialization_. **/
	public constructor(removal_error: Error) {
		super();
		this._removal_error = removal_error;
	}

	/** Responsibilities: _removal race setup_. **/
	public schedule_removal_race(record_path: string): void {
		this._record_path = resolve(record_path);
		this._inventory_captured = false;
	}

	/** Responsibilities: _cache inventory interleaving_. **/
	public override list_entries(directory: string): readonly FileEntry[] {
		const entries = super.list_entries(directory);
		if (!this._inventory_captured && resolve(directory) === dirname(this._record_path)) {
			super.remove_file(this._record_path);
			this._inventory_captured = true;
		}
		return entries;
	}

	/** Responsibilities: _scheduled missing-record failure_. **/
	public override remove_file(file: string): void {
		if (resolve(file) === this._record_path && this._inventory_captured) {
			throw this._removal_error;
		}
		super.remove_file(file);
	}
}
