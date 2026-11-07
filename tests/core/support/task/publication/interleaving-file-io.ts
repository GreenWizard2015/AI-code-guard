import { dirname, join } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { CallableInterleaving } from "tests/core/types";

/** Responsibilities: _directory creation interleaving_, _claim removal interleaving_. **/
export class InterleavingFileIO extends InMemoryFileIO {
	private readonly _interleavings: CallableInterleaving[];
	private readonly _move_interleavings: CallableInterleaving[];
	private readonly _target: string;

	/** Responsibilities: _POSIX empty-directory rename behavior_. **/
	private replace_empty_destination_like_posix(destination: string): void {
		if (!this.file(destination).path_exists() || !this.path_is_directory(destination)) {
			return;
		}
		if (this.list_entries(destination).length === 0) {
			this.remove_path(destination);
		}
	}

	/** Responsibilities: _race target initialization_. **/
	public constructor(target: string) {
		super();
		this._interleavings = [];
		this._move_interleavings = [];
		this._target = target;
	}

	/** Responsibilities: _stale claim state setup_. **/
	public seed_stale_claim(owner_text: string): void {
		this.create_directory(dirname(this._target));
		this.create_directory(this._target);
		this.file(join(this._target, "owner")).write_text(owner_text);
	}

	/** Responsibilities: _race action scheduling_. **/
	public set_interleave(callback: CallableInterleaving): void {
		this._interleavings.push(callback);
	}

	/** Responsibilities: _interleaved directory creation_. **/
	public override create_directory_exclusive(directory: string): void {
		super.create_directory_exclusive(directory);
		if (directory !== this._target && !directory.startsWith(`${this._target}.`)) {
			return;
		}
		const callback = this._interleavings.shift();
		if (callback !== undefined) {
			callback();
		}
	}

	/** Responsibilities: _stale claim move scheduling_. **/
	public set_move_interleave(callback: CallableInterleaving): void {
		this._move_interleavings.push(callback);
	}

	/** Responsibilities: _stale claim move interleaving_. **/
	public override move_path(source: string, destination: string): void {
		if (source === this._target) {
			const callback = this._move_interleavings.shift();
			if (callback !== undefined) {
				callback();
			}
			this.replace_empty_destination_like_posix(destination);
		}
		super.move_path(source, destination);
	}
}
