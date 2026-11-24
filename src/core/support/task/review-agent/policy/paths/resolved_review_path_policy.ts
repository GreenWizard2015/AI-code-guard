import { dirname, isAbsolute, relative, resolve } from "node:path";
import { AI_CODE_GUARD_DIRECTORY, RESOLVED_REVIEW_DIRECTORY } from "src/core/support/task/review-agent/constants";
import type { ResolvedReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review path authorization_, _project boundary enforcement_. **/
export class ResolvedReviewPathPolicy implements ResolvedReviewPathPolicyContract {
	private readonly _io: IOContract;
	private readonly _cwd: string;

	/** Responsibilities: _canonical existing ancestor resolution_. **/
	private canonical_existing_path(path_to_resolve: string): string {
		let current = path_to_resolve;
		while (true) {
			if (this._io.file(current).path_exists()) {
				return this._io.file(current).real_path();
			}
			const parent = dirname(current);
			if (parent === current) {
				return resolve(current);
			}
			current = parent;
		}
	}

	/** Responsibilities: _existing path canonicalization_. **/
	private canonical_path(path: string): string {
		if (!this._io.file(path).path_exists()) {
			return resolve(path);
		}
		return this._io.file(path).real_path();
	}

	/** Responsibilities: _directory ancestor containment_. **/
	private ancestor_path(candidate_path: string): boolean {
		const candidate = this.canonical_path(candidate_path);
		const candidate_is_directory = this._io.path_is_directory(candidate);
		const original_is_directory = this._io.path_is_directory(candidate_path);
		if (!candidate_is_directory && !original_is_directory) {
			return false;
		}
		const relation = relative(candidate, this.root());
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _review archive root_. **/
	private root(): string {
		const path = resolve(this._cwd, AI_CODE_GUARD_DIRECTORY, RESOLVED_REVIEW_DIRECTORY);
		if (!this._io.file(path).path_exists()) {
			return resolve(path);
		}
		return this._io.file(path).real_path();
	}

	/** Responsibilities: _review path containment_. **/
	private contains(review_candidate_path: string): boolean {
		const root = this.root();
		const candidate = this.canonical_path(review_candidate_path);
		const relation = relative(root, candidate);
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(io: IOContract, cwd: string) {
		this._io = io;
		this._cwd = cwd;
	}

	/** Responsibilities: _ancestor path access_. **/
	public blocks(absolute_path: string, include_ancestors = false): boolean {
		if (this.contains(absolute_path)) {
			return true;
		}
		if (!include_ancestors) {
			return false;
		}
		return this.ancestor_path(absolute_path);
	}

	/** Responsibilities: _project-root containment_. **/
	public within_project_root(project_entry_path: string): boolean {
		const project_root = this._io.file(this._cwd).real_path();
		const canonical_path = this.canonical_existing_path(project_entry_path);
		const relation = relative(project_root, canonical_path);
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _review path access_. **/
	public allows_path_from(command_path: string, command_cwd: string): boolean {
		if (command_path === "") {
			return true;
		}
		const absolute_path = resolve(command_cwd, command_path);
		if (this.blocks(absolute_path, false)) {
			return false;
		}
		if (!this.within_project_root(absolute_path)) {
			return false;
		}
		if (!this._io.file(absolute_path).path_exists()) {
			return true;
		}
		if (this._io.file(absolute_path).symbolic_link()) {
			return this.within_project_root(this._io.file(absolute_path).real_path());
		}
		return true;
	}
}
