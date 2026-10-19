import { isAbsolute, relative, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY, RESOLVED_REVIEW_DIRECTORY } from "src/core/support/task/review-agent/constants";
import type { ResolvedReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import { DIRECTORY_ENTRY_DIRECTORY } from "src/io/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review path authorization_, _archive root lookup_. **/
export class ResolvedReviewPathPolicy implements ResolvedReviewPathPolicyContract {
	private readonly io: IOContract;

	/** Responsibilities: _existing path canonicalization_. **/
	private canonical_path(path: string): string {
		if (!this.io.file_paths.path_exists(path)) {
			return resolve(path);
		}
		return this.io.file_paths.real_path(path);
	}

	/** Responsibilities: _directory ancestor containment_. **/
	private ancestor_path(absolute_path: string, cwd: string): boolean {
		const candidate = this.canonical_path(absolute_path);
		const candidate_is_directory = this.io.directory_entries.path_kind(candidate) === DIRECTORY_ENTRY_DIRECTORY;
		const original_is_directory = this.io.directory_entries.path_kind(absolute_path) === DIRECTORY_ENTRY_DIRECTORY;
		if (!candidate_is_directory && !original_is_directory) {
			return false;
		}
		const relation = relative(candidate, this.root(cwd));
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(io: IOContract) {
		this.io = io;
	}

	/** Responsibilities: _review archive root_. **/
	public root(cwd: string): string {
		const path = resolve(cwd, AI_CODE_GUARD_DIRECTORY, RESOLVED_REVIEW_DIRECTORY);
		if (!this.io.file_paths.path_exists(path)) {
			return resolve(path);
		}
		return this.io.file_paths.real_path(path);
	}

	/** Responsibilities: _review path containment_. **/
	public contains(absolute_path: string, cwd: string): boolean {
		const root = this.root(cwd);
		const candidate = this.canonical_path(absolute_path);
		const relation = relative(root, candidate);
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _ancestor path access_. **/
	public blocks(absolute_path: string, cwd: string, include_ancestors = false): boolean {
		if (this.contains(absolute_path, cwd)) {
			return true;
		}
		if (!include_ancestors) {
			return false;
		}
		return this.ancestor_path(absolute_path, cwd);
	}
}
