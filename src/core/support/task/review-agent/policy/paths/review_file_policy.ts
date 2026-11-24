import { resolve } from "node:path";
import { MAX_REVIEW_LINES } from "src/constants";
import { REVIEW_STATUS_RESOLVED } from "src/core/support/task/review-agent/constants";
import type { ReviewFilePolicyContract, ReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import { ReviewFindingDocument } from "src/core/support/task/review-agent/review_finding_document";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review artifact policy_, _review state policy_. **/
export class ReviewFilePolicy implements ReviewFilePolicyContract {
	private readonly _path: string;
	private readonly _cwd: string;
	private readonly _paths: ReviewPathPolicyContract;
	private readonly _io: IOContract;

	/** Responsibilities: _review artifact scope_. **/
	private existing_review(): boolean {
		if (!this._paths.allows_file(this._path)) {
			return false;
		}
		return this._io.file(resolve(this._cwd, this._path)).path_exists();
	}

	/** Responsibilities: _review artifact policy initialization_. **/
	public constructor(path: string, cwd: string, paths: ReviewPathPolicyContract, io: IOContract) {
		this._path = path;
		this._cwd = cwd;
		this._paths = paths;
		this._io = io;
	}

	/** Responsibilities: _review state transitions_. **/
	public open_for_mutation(): boolean {
		if (!this.existing_review()) {
			return false;
		}
		const file = resolve(this._cwd, this._path);
		const resource = this._io.file(file);
		const text = resource.file_text();
		const finding_document = new ReviewFindingDocument(text);
		const status = finding_document.status();
		return status !== REVIEW_STATUS_RESOLVED;
	}

	/** Responsibilities: _review file permission_. **/
	public allows_write(): boolean {
		if (!this._paths.allows_file(this._path)) {
			return false;
		}
		if (!this._io.file(resolve(this._cwd, this._path)).path_exists()) {
			return true;
		}
		return this.open_for_mutation();
	}

	/** Responsibilities: _review artifact deletion authorization_. **/
	public allows_patch_deletion(): boolean {
		if (!this.existing_review()) {
			return false;
		}
		const file = resolve(this._cwd, this._path);
		return this._io.file(file).file_text().split(/\r?\n/u).length > MAX_REVIEW_LINES;
	}
}
