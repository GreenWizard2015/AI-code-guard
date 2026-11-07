import { basename, dirname, extname, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_COMPLETION_FILE,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
} from "src/core/support/task/review-agent/constants";
import { ResolvedReviewPathPolicy } from "src/core/support/task/review-agent/policy/resolved_review_path_policy";
import type { ReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { HookDecision } from "src/model_types";

/** Responsibilities: _review directory boundary_, _review file ownership_. **/
export class ReviewPathPolicy implements ReviewPathPolicyContract {
	private readonly _root: string;
	private readonly _review_root: string;
	private readonly _io: IOContract;
	private readonly _resolved_review_paths: ResolvedReviewPathPolicy;

	/** Responsibilities: _review directory boundary_. **/
	private review_root_directory(): boolean {
		if (!this._io.path_is_directory(this._review_root)) {
			return false;
		}
		if (this._io.file(this._review_root).symbolic_link()) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _review directory ownership_. **/
	private project_root_match(): boolean {
		const project_root = this._io.file(this._root).real_path();
		const real_review_root = this._io.file(this._review_root).real_path();
		const expected_review_root = resolve(project_root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		if (real_review_root !== expected_review_root) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _review directory boundary_. **/
	private owned_review_root(): boolean {
		if (this._io.file(this._review_root).path_exists()) {
			if (!this.review_root_directory()) {
				return false;
			}
			return this.project_root_match();
		}
		return this.missing_review_root();
	}

	/** Responsibilities: _nearest existing review ancestor_. **/
	private existing_review_ancestor(review_root: string): string {
		let ancestor = dirname(review_root);
		while (!this._io.file(ancestor).path_exists()) {
			const parent = dirname(ancestor);
			if (parent === ancestor) {
				return "";
			}
			ancestor = parent;
		}
		return ancestor;
	}

	/** Responsibilities: _new review directory boundary_. **/
	private missing_review_root(): boolean {
		if (this._io.file(this._review_root).symbolic_link()) {
			return false;
		}
		const ancestor = this.existing_review_ancestor(this._review_root);
		if (ancestor === "") {
			return false;
		}
		if (this._io.file(ancestor).symbolic_link()) {
			return false;
		}
		if (!this._io.path_is_directory(ancestor)) {
			return false;
		}
		return this._resolved_review_paths.within_project_root(this._review_root);
	}

	/** Responsibilities: _review file naming_. **/
	private valid_review_name(review_file_path: string): boolean {
		const name = basename(review_file_path);
		if (extname(review_file_path) !== ".md") {
			return false;
		}
		if (name === REVIEW_COMPLETION_FILE) {
			return false;
		}
		return name !== REVIEW_FAILURE_FILE;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(io: IOContract, cwd: string) {
		this._root = cwd;
		this._review_root = resolve(this._root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		this._io = io;
		this._resolved_review_paths = new ResolvedReviewPathPolicy(io, cwd);
	}

	/** Responsibilities: _public operation_. **/
	public allows_file(review_file_path: string): boolean {
		const absolute_path = resolve(this._root, review_file_path);
		if (!this.owned_review_root()) {
			return false;
		}
		if (resolve(dirname(absolute_path)) !== this._review_root) {
			return false;
		}
		if (!this.valid_review_name(absolute_path)) {
			return false;
		}
		if (!this._io.file(absolute_path).path_exists()) {
			return true;
		}
		if (this._io.file(absolute_path).symbolic_link()) {
			return false;
		}
		return this._io.path_is_file(absolute_path);
	}

	/** Responsibilities: _review file authorization_. **/
	public write_decision(file_path: string, fallback_path: string): HookDecision {
		let selected_path = file_path;
		if (selected_path === "") {
			selected_path = fallback_path;
		}
		if (this.allows_file(selected_path)) {
			return { allowed: true, reason: "" };
		}
		return { allowed: false, reason: "The review agent may write only Markdown findings in .ai-code-guard/review/." };
	}

	/** Responsibilities: _path boundary_. **/
	public allows_read_path(read_path: string): boolean {
		return this.allows_recursive_path(read_path, this._root);
	}

	/** Responsibilities: _project root identity_. **/
	public project_root(): string {
		return this._root;
	}

	/** Responsibilities: _command path boundary_. **/
	public allows_path_from(command_path: string, command_cwd: string): boolean {
		if (command_path === "") {
			return true;
		}
		const absolute_path = resolve(command_cwd, command_path);
		if (this._resolved_review_paths.blocks(absolute_path, false)) {
			return false;
		}
		if (!this._resolved_review_paths.within_project_root(absolute_path)) {
			return false;
		}
		if (!this._io.file(absolute_path).path_exists()) {
			return true;
		}
		if (this._io.file(absolute_path).symbolic_link()) {
			return this._resolved_review_paths.within_project_root(this._io.file(absolute_path).real_path());
		}
		return true;
	}

	/** Responsibilities: _recursive command path boundary_. **/
	public allows_recursive_path(command_path: string, command_cwd: string): boolean {
		const absolute_path = resolve(command_cwd, command_path);
		if (this._resolved_review_paths.blocks(absolute_path, true)) {
			return false;
		}
		return this.allows_path_from(command_path, command_cwd);
	}
}
