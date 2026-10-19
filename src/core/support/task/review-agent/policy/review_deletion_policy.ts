import { resolve } from "node:path";
import { REVIEW_STATUS_RESOLVED } from "src/core/support/task/review-agent/constants";
import type { ReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";
import { MAX_REVIEW_LINES } from "src/constants";
import type { HookDecision } from "src/model/types/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review artifact access policy_, _review deletion authorization_. **/
export class ReviewDeletionPolicy {
	private readonly paths: ReviewPathPolicyContract;
	private readonly trusted_removal_commands: ReadonlySet<string>;
	private readonly io: IOContract;

	/** Responsibilities: _oversized review file detection_. **/
	private oversized_review(path: string, cwd: string): boolean {
		if (!this.paths.allows_file(path, cwd)) {
			return false;
		}
		const file = resolve(cwd, path);
		if (!this.io.file_paths.path_exists(file)) {
			return false;
		}
		return this.io.file_content.file_text(file).split(/\r?\n/u).length > MAX_REVIEW_LINES;
	}

	/** Responsibilities: _review file status_. **/
	private review_file(path: string, cwd: string): boolean {
		if (!this.paths.allows_file(path, cwd)) {
			return false;
		}
		const file = resolve(cwd, path);
		if (!this.io.file_paths.path_exists(file)) {
			return false;
		}
		return !this.io.file_content
			.file_text(file)
			.split(/\r?\n/u)
			.some((line) => line.trim() === REVIEW_STATUS_RESOLVED);
	}

	/** Responsibilities: _removal command arguments_. **/
	private removal_arguments(command: string): string {
		const text = command.trim();
		const separator = text.indexOf(" ");
		if (separator < 0) {
			return "";
		}
		if (!this.trusted_removal_commands.has(text.slice(0, separator))) {
			return "";
		}
		return text.slice(separator).trim();
	}

	/** Responsibilities: _review removal command path_. **/
	private single_removal_file(arguments_text: string): string {
		let file = "";
		let count = 0;
		for (const word of arguments_text.split(/\s+/u)) {
			if (word.startsWith("-")) {
				continue;
			}
			file = word;
			count += 1;
		}
		if (count !== 1) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _review removal command path_. **/
	private removal_command_file(command: string): string {
		const arguments_text = this.removal_arguments(command);
		if (arguments_text.length === 0) {
			return "";
		}
		return this.single_removal_file(arguments_text);
	}

	/** Responsibilities: _deletion denial wording_. **/
	private deletion_denial_reason(cleanup: boolean): string {
		if (cleanup) {
			return "Cleanup may remove only one existing open Markdown finding from .ai-code-guard/review/.";
		}
		return "Only an oversized open review file may be removed after its findings are split.";
	}

	/** Responsibilities: _command working-directory resolution_. **/
	private effective_command_cwd(cwd: string, command_cwd: string): string {
		if (command_cwd === "") {
			return cwd;
		}
		return command_cwd;
	}

	/** Responsibilities: _deletion target validation_. **/
	private deletion_target(command: string, cwd: string, cleanup: boolean, command_cwd: string): HookDecision {
		const file = this.removal_command_file(command);
		if (file === "") {
			return { allowed: false, reason: this.deletion_denial_reason(cleanup) };
		}
		const target_cwd = this.effective_command_cwd(cwd, command_cwd);
		if (!this.review_file(resolve(target_cwd, file), cwd)) {
			return { allowed: false, reason: this.deletion_denial_reason(cleanup) };
		}
		return { allowed: true, reason: "" };
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(paths: ReviewPathPolicyContract, io: IOContract) {
		this.paths = paths;
		this.io = io;
		this.trusted_removal_commands = new Set([
			"/bin/rm",
			"/usr/bin/rm",
			"/usr/local/bin/rm",
			"/sbin/rm",
			"/usr/sbin/rm",
		]);
	}

	/** Responsibilities: _review file policy_. **/
	public allows_write(path: string, cwd: string): boolean {
		const file = resolve(cwd, path);
		if (!this.io.file_paths.path_exists(file)) {
			return true;
		}
		return this.review_file(path, cwd);
	}

	/** Responsibilities: _review file access_. **/
	public open_review_file(path: string, cwd: string): boolean {
		if (!this.paths.allows_file(path, cwd)) {
			return false;
		}
		const file = resolve(cwd, path);
		if (!this.io.file_paths.path_exists(file)) {
			return false;
		}
		return !this.io.file_content
			.file_text(file)
			.split(/\r?\n/u)
			.some((line) => line.trim() === REVIEW_STATUS_RESOLVED);
	}

	/** Responsibilities: _patch deletion authorization_. **/
	public allows_patch_deletion(path: string, cwd: string, cleanup: boolean): boolean {
		if (cleanup) {
			return this.review_file(path, cwd);
		}
		return this.oversized_review(path, cwd);
	}

	/** Responsibilities: _issue deletion authorization_. **/
	public deletion_decision(command: string, cwd: string, cleanup: boolean, command_cwd = ""): HookDecision {
		const target = this.deletion_target(command, cwd, cleanup, command_cwd);
		if (!target.allowed) {
			return target;
		}
		if (cleanup) {
			return target;
		}
		const file = this.removal_command_file(command);
		if (this.oversized_review(file, cwd)) {
			return target;
		}
		return { allowed: false, reason: this.deletion_denial_reason(cleanup) };
	}
}
