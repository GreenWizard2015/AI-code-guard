import {
	PATCH_ADD_FILE_PREFIX,
	PATCH_DELETE_FILE_PREFIX,
	PATCH_MOVE_FILE_PREFIX,
	PATCH_UPDATE_FILE_PREFIX,
} from "src/core/support/task/review-agent/constants";
import type {
	ReviewDeletionPolicyContract,
	ReviewPatchRequest,
	ReviewPathPolicyContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _patch path scope_, _review file policy_. **/
export class ReviewPatchMutation {
	private readonly _patch: string;
	private readonly _cwd: string;
	private readonly _paths: ReviewPathPolicyContract;
	private readonly _deletion_policy: ReviewDeletionPolicyContract;

	/** Responsibilities: _patch path extraction_. **/
	private extract_paths(): string[] {
		const paths: string[] = [];
		for (const line of this._patch.split("\n")) {
			if (line.startsWith(PATCH_ADD_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_ADD_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_UPDATE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_UPDATE_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_DELETE_FILE_PREFIX.length));
			}
			if (line.startsWith(PATCH_MOVE_FILE_PREFIX)) {
				paths.push(line.slice(PATCH_MOVE_FILE_PREFIX.length));
			}
		}
		return paths;
	}

	/** Responsibilities: _deletion operation authorization_. **/
	private deletions_allowed(): boolean {
		for (const line of this._patch.split("\n")) {
			if (line.startsWith(PATCH_MOVE_FILE_PREFIX)) {
				return false;
			}
			if (!line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				continue;
			}
			const path = line.slice(PATCH_DELETE_FILE_PREFIX.length);
			if (!this._deletion_policy.file(path, this._cwd).allows_patch_deletion()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _review file mutability_. **/
	private open_paths_allowed(): boolean {
		for (const line of this._patch.split("\n")) {
			if (line.startsWith(PATCH_ADD_FILE_PREFIX)) {
				const path = line.slice(PATCH_ADD_FILE_PREFIX.length);
				if (!this._deletion_policy.file(path, this._cwd).allows_write()) {
					return false;
				}
				continue;
			}
			if (!line.startsWith(PATCH_UPDATE_FILE_PREFIX) && !line.startsWith(PATCH_DELETE_FILE_PREFIX)) {
				continue;
			}
			const path = line.slice(line.indexOf(": ") + 2);
			if (!this._deletion_policy.file(path, this._cwd).open_for_mutation()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _patch policy dependencies_. **/
	public constructor(
		request: ReviewPatchRequest,
		paths: ReviewPathPolicyContract,
		deletion_policy: ReviewDeletionPolicyContract,
	) {
		const patch = request.input.patch;
		if (typeof patch === "string" && patch.length > 0) {
			this._patch = patch;
		} else {
			this._patch = request.input.command;
		}
		this._cwd = request.cwd;
		this._paths = paths;
		this._deletion_policy = deletion_policy;
	}

	/** Responsibilities: _patch path scope validation_. **/
	public paths_allowed(): boolean {
		const paths = this.extract_paths();
		if (paths.length === 0) {
			return false;
		}
		for (const path of paths) {
			if (!this._paths.allows_file(path)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _patch authorization_. **/
	public allowed(): boolean {
		if (!this.deletions_allowed()) {
			return false;
		}
		if (!this.paths_allowed()) {
			return false;
		}
		return this.open_paths_allowed();
	}
}
