import { resolve } from "node:path";
import { REVIEW_DELETION_DENIAL_REASON } from "src/core/support/task/review-agent/constants";
import { ReviewFilePolicy } from "src/core/support/task/review-agent/policy/review_file_policy";
import type {
	ReviewDeletionPolicyContract,
	ReviewFilePolicyContract,
	ReviewPathPolicyContract,
} from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";
import type { HookDecision } from "src/model_types";
import type { HookPayload } from "src/model_types";

/** Responsibilities: _review artifact access policy_, _review deletion authorization_. **/
export class ReviewDeletionPolicy implements ReviewDeletionPolicyContract {
	private readonly _paths: ReviewPathPolicyContract;
	private readonly _trusted_removal_commands: ReadonlySet<string>;
	private readonly _io: IOContract;
	private readonly _command: string;
	private readonly _cwd: string;
	private readonly _command_cwd: string;

	/** Responsibilities: _removal command arguments_. **/
	private removal_arguments(): string {
		const text = this._command.trim();
		const separator = text.indexOf(" ");
		if (separator < 0) {
			return "";
		}
		if (!this._trusted_removal_commands.has(text.slice(0, separator))) {
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
	private removal_command_file(): string {
		const arguments_text = this.removal_arguments();
		if (arguments_text.length === 0) {
			return "";
		}
		return this.single_removal_file(arguments_text);
	}

	/** Responsibilities: _command working-directory resolution_. **/
	private effective_command_cwd(): string {
		if (this._command_cwd === "") {
			return this._cwd;
		}
		return this._command_cwd;
	}

	/** Responsibilities: _deletion target validation_. **/
	private deletion_target(): HookDecision {
		const file = this.removal_command_file();
		if (file === "") {
			return { allowed: false, reason: REVIEW_DELETION_DENIAL_REASON };
		}
		const target_cwd = this.effective_command_cwd();
		if (!this.file(resolve(target_cwd, file), this._cwd).open_for_mutation()) {
			return { allowed: false, reason: REVIEW_DELETION_DENIAL_REASON };
		}
		return { allowed: true, reason: "" };
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(payload: HookPayload, paths: ReviewPathPolicyContract, io: IOContract, command_cwd: string) {
		this._paths = paths;
		this._io = io;
		this._command = payload.tool_input.command;
		this._cwd = payload.cwd;
		this._command_cwd = command_cwd;
		this._trusted_removal_commands = new Set([
			"/bin/rm",
			"/usr/bin/rm",
			"/usr/local/bin/rm",
			"/sbin/rm",
			"/usr/sbin/rm",
		]);
	}

	/** Responsibilities: _single review artifact policy_. **/
	public file(path: string, cwd: string): ReviewFilePolicyContract {
		return new ReviewFilePolicy(path, cwd, this._paths, this._io);
	}

	/** Responsibilities: _issue deletion authorization_. **/
	public deletion_decision(): HookDecision {
		const target = this.deletion_target();
		if (!target.allowed) {
			return target;
		}
		const file = this.removal_command_file();
		if (this.file(file, this._cwd).allows_patch_deletion()) {
			return target;
		}
		return { allowed: false, reason: REVIEW_DELETION_DENIAL_REASON };
	}
}
