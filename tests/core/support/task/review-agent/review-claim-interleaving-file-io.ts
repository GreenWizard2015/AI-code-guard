import type { ReviewRecoveryClaim } from "src/core/support/task/review-agent/review_recovery_claim";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import type { CallableInterleaving } from "tests/core/types";

/** Responsibilities: _claim race fixture_, _move interleaving_. **/
export class ReviewClaimInterleavingFileIO extends InMemoryFileIO {
	private readonly _claim_path: string;
	private readonly _move_interleavings: CallableInterleaving[];
	private readonly _claim_contenders: Map<string, ReviewRecoveryClaim>;
	private readonly _claimed_contenders: Set<string>;
	private readonly _acquired_contenders: Set<string>;

	/** Responsibilities: _empty directory replacement_. **/
	private replace_empty_destination_like_posix(destination: string): void {
		if (!this.file(destination).path_exists() || !this.path_is_directory(destination)) {
			return;
		}
		if (this.list_entries(destination).length === 0) {
			this.remove_path(destination);
		}
	}

	/** Responsibilities: _claim race fixture initialization_. **/
	public constructor(claim_path: string) {
		super();
		this._claim_path = claim_path;
		this._move_interleavings = [];
		this._claim_contenders = new Map();
		this._claimed_contenders = new Set();
		this._acquired_contenders = new Set();
	}

	/** Responsibilities: _reentrant contender registration_. **/
	public register_contender(key: string, contender: ReviewRecoveryClaim): void {
		this._claim_contenders.set(key, contender);
	}

	/** Responsibilities: _single stale claim attempt_. **/
	public claim_contender_once(key: string): boolean {
		if (this._claimed_contenders.has(key)) {
			return false;
		}
		const contender = this._claim_contenders.get(key);
		if (contender === undefined) {
			return false;
		}
		this._claimed_contenders.add(key);
		const acquired = contender.claim();
		if (acquired) {
			this._acquired_contenders.add(key);
		}
		return acquired;
	}

	/** Responsibilities: _stale claim acquisition status_. **/
	public contender_acquired(key: string): boolean {
		return this._acquired_contenders.has(key);
	}

	/** Responsibilities: _claim move scheduling_. **/
	public before_stale_claim_move(callback: CallableInterleaving): void {
		this._move_interleavings.push(callback);
	}

	/** Responsibilities: _claim move interception_. **/
	public override move_path(source: string, destination: string): void {
		if (source === this._claim_path) {
			const callback = this._move_interleavings.shift();
			if (callback !== undefined) {
				callback();
			}
			this.replace_empty_destination_like_posix(destination);
		}
		super.move_path(source, destination);
	}
}
