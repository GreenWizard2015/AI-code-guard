import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_COMPLETION_FILE,
	REVIEW_DIRECTORY,
	REVIEW_FAILURE_FILE,
	REVIEW_FILES_FROM_OPTION,
	REVIEW_IGNORE_FILE_OPTION,
} from "src/core/support/task/review-agent/constants";
import type { ReviewPathPolicyContract, ReviewReadCommandContext } from "src/core/support/task/review-agent/protocols";
import { RecursiveReviewSearchPolicy } from "src/core/support/task/review-agent/policy/recursive_review_search_policy";
import { ResolvedReviewPathPolicy } from "src/core/support/task/review-agent/policy/resolved_review_path_policy";
import type { StringSetMap } from "src/analysis_types";
import type { HookDecision } from "src/model/types/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review directory boundary_, _review file ownership_. **/
export class ReviewPathPolicy implements ReviewPathPolicyContract {
	private readonly file_value_options: StringSetMap;
	private readonly io: IOContract;
	private readonly resolved_review_paths: ResolvedReviewPathPolicy;
	private readonly recursive_review_search: RecursiveReviewSearchPolicy;

	/** Responsibilities: _review directory boundary_. **/
	private review_root_directory(review_root: string): boolean {
		if (!this.io.directory_entries.path_is_directory(review_root)) {
			return false;
		}
		if (this.io.file_paths.symbolic_link(review_root)) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _review directory ownership_. **/
	private project_root_match(review_root: string, cwd: string): boolean {
		const project_root = this.io.file_paths.real_path(cwd);
		const real_review_root = this.io.file_paths.real_path(review_root);
		const expected_review_root = resolve(project_root, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		if (real_review_root !== expected_review_root) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _review directory boundary_. **/
	private owned_review_root(review_root: string, cwd: string): boolean {
		if (this.io.file_paths.path_exists(review_root)) {
			if (!this.review_root_directory(review_root)) {
				return false;
			}
			return this.project_root_match(review_root, cwd);
		}
		return this.missing_review_root(review_root, cwd);
	}

	/** Responsibilities: _nearest existing review ancestor_. **/
	private existing_review_ancestor(review_root: string): string {
		let ancestor = dirname(review_root);
		while (!this.io.file_paths.path_exists(ancestor)) {
			const parent = dirname(ancestor);
			if (parent === ancestor) {
				return "";
			}
			ancestor = parent;
		}
		return ancestor;
	}

	/** Responsibilities: _new review directory boundary_. **/
	private missing_review_root(review_root: string, cwd: string): boolean {
		if (this.io.file_paths.symbolic_link(review_root)) {
			return false;
		}
		const ancestor = this.existing_review_ancestor(review_root);
		if (ancestor === "") {
			return false;
		}
		if (this.io.file_paths.symbolic_link(ancestor)) {
			return false;
		}
		if (!this.io.directory_entries.path_is_directory(ancestor)) {
			return false;
		}
		return this.within_project_root(review_root, cwd);
	}

	/** Responsibilities: _review path containment_. **/
	private within_review_root(absolute_path: string, cwd: string): boolean {
		const review_root = resolve(cwd, AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY);
		if (!this.owned_review_root(review_root, cwd)) {
			return false;
		}
		return resolve(dirname(absolute_path)) === review_root;
	}

	/** Responsibilities: _root containment_. **/
	private within_project_root(absolute_path: string, cwd: string): boolean {
		const project_root = this.io.file_paths.real_path(cwd);
		const canonical_path = this.canonical_existing_path(absolute_path);
		const relation = relative(project_root, canonical_path);
		if (relation === "") {
			return true;
		}
		if (relation.startsWith("..")) {
			return false;
		}
		return !isAbsolute(relation);
	}

	/** Responsibilities: _canonical existing ancestor resolution_. **/
	private canonical_existing_path(path: string): string {
		let current = path;
		while (true) {
			if (this.io.file_paths.path_exists(current)) {
				return this.io.file_paths.real_path(current);
			}
			const parent = dirname(current);
			if (parent === current) {
				return resolve(current);
			}
			current = parent;
		}
	}

	/** Responsibilities: _option value boundary_. **/
	private allows_option_value(
		options: ReadonlySet<string>,
		word: string,
		root_cwd: string,
		command_cwd: string,
	): boolean {
		for (const option of options) {
			if (word.startsWith(`${option}=`)) {
				return this.allows_path_from(word.slice(option.length + 1), command_cwd, root_cwd);
			}
			const is_short_option = option.length === 2;
			let has_attached_value = false;
			if (word.startsWith(option)) {
				has_attached_value = word.length > option.length;
			}
			if (is_short_option && has_attached_value) {
				return this.allows_path_from(word.slice(option.length), command_cwd, root_cwd);
			}
		}
		return true;
	}

	/** Responsibilities: _file-valued option boundary_. **/
	private allows_option_path(command: string, word: string, root_cwd: string, command_cwd: string): boolean {
		const options = this.file_value_options.get(basename(command));
		if (options === undefined) {
			return true;
		}
		return this.allows_option_value(options, word, root_cwd, command_cwd);
	}

	/** Responsibilities: _command word boundary_. **/
	private allows_read_word(context: ReviewReadCommandContext, index: number): boolean {
		const word = context.words[index];
		if (word === undefined) {
			return true;
		}
		if (word.startsWith("-")) {
			return this.allows_option_path(context.command, word, context.root_cwd, context.command_cwd);
		}
		if (context.recursive) {
			const absolute_path = resolve(context.command_cwd, word);
			if (this.resolved_review_paths.blocks(absolute_path, context.root_cwd, true)) {
				return false;
			}
		}
		return this.allows_path_from(word, context.command_cwd, context.root_cwd);
	}

	/** Responsibilities: _command argument authorization_. **/
	private allows_command_words(context: ReviewReadCommandContext): boolean {
		for (let index = 1; index < context.words.length; index += 1) {
			if (!this.allows_read_word(context, index)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _review file naming_. **/
	private valid_review_name(absolute_path: string): boolean {
		const name = basename(absolute_path);
		if (extname(absolute_path) !== ".md") {
			return false;
		}
		if (name === REVIEW_COMPLETION_FILE) {
			return false;
		}
		return name !== REVIEW_FAILURE_FILE;
	}

	/** Responsibilities: _command path boundary_. **/
	private allows_path_from(path: string, command_cwd: string, root_cwd: string): boolean {
		if (path === "") {
			return true;
		}
		const absolute_path = resolve(command_cwd, path);
		if (this.resolved_review_paths.blocks(absolute_path, root_cwd)) {
			return false;
		}
		if (!this.within_project_root(absolute_path, root_cwd)) {
			return false;
		}
		if (!this.io.file_paths.path_exists(absolute_path)) {
			return true;
		}
		if (this.io.file_paths.symbolic_link(absolute_path)) {
			return this.within_project_root(this.io.file_paths.real_path(absolute_path), root_cwd);
		}
		return true;
	}

	/** Responsibilities: _field initialization_. **/
	constructor(io: IOContract) {
		this.io = io;
		this.resolved_review_paths = new ResolvedReviewPathPolicy(io);
		this.recursive_review_search = new RecursiveReviewSearchPolicy(this.resolved_review_paths);
		this.file_value_options = new Map([
			["awk", new Set(["-f"])],
			["grep", new Set(["-f", "--file"])],
			["rg", new Set(["-f", "--file", REVIEW_IGNORE_FILE_OPTION])],
			["sed", new Set(["-f"])],
			["sort", new Set([REVIEW_FILES_FROM_OPTION])],
		]);
	}

	/** Responsibilities: _public operation_. **/
	public allows_file(path: string, cwd: string): boolean {
		const absolute_path = resolve(cwd, path);
		if (!this.within_review_root(absolute_path, cwd)) {
			return false;
		}
		if (!this.valid_review_name(absolute_path)) {
			return false;
		}
		if (!this.io.file_paths.path_exists(absolute_path)) {
			return true;
		}
		if (this.io.file_paths.symbolic_link(absolute_path)) {
			return false;
		}
		return this.io.directory_entries.path_is_file(absolute_path);
	}

	/** Responsibilities: _review file authorization_. **/
	public write_decision(file_path: string, fallback_path: string, cwd: string): HookDecision {
		let selected_path = file_path;
		if (selected_path === "") {
			selected_path = fallback_path;
		}
		if (this.allows_file(selected_path, cwd)) {
			return { allowed: true, reason: "" };
		}
		return { allowed: false, reason: "The review agent may write only Markdown findings in .ai-code-guard/review/." };
	}

	/** Responsibilities: _path boundary_. **/
	public allows_read_path(path: string, cwd: string): boolean {
		if (this.resolved_review_paths.blocks(resolve(cwd, path), cwd, true)) {
			return false;
		}
		return this.allows_path_from(path, cwd, cwd);
	}

	/** Responsibilities: _command boundary_. **/
	public allows_read_command(command: string, words: readonly string[], cwd: string, command_cwd = ""): boolean {
		let effective_command_cwd = cwd;
		if (command_cwd !== "") {
			effective_command_cwd = command_cwd;
		}
		if (this.recursive_review_search.blocks(command, words, effective_command_cwd, cwd)) {
			return false;
		}
		const context = {
			command,
			words,
			root_cwd: cwd,
			command_cwd: effective_command_cwd,
			recursive: this.recursive_review_search.recursive(command, words),
		};
		return this.allows_command_words(context);
	}
}
