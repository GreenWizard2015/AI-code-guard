import { basename, resolve } from "node:path";
import type { StringSetMap } from "src/analysis_types";
import { REVIEW_FILES_FROM_OPTION, REVIEW_IGNORE_FILE_OPTION } from "src/core/support/task/review-agent/constants";
import { CommandOptionPolicy } from "src/core/support/task/review-agent/policy/command_option_policy";
import { CommandPolicy } from "src/core/support/task/review-agent/policy/command_policy";
import { RecursiveReviewSearchPolicy } from "src/core/support/task/review-agent/policy/recursive_review_search_policy";
import { ReviewShellCommand } from "src/core/support/task/review-agent/policy/review_shell_command";
import type {
	CommandPolicyContract,
	ReviewPathPolicyContract,
	ReviewReadCommandContext,
	ReviewReadPolicyContract,
} from "src/core/support/task/review-agent/protocols";
import type { HookDecision } from "src/model_types";

/** Responsibilities: _read-only shell classification_, _read-only shell authorization_. **/
export class ReviewReadPolicy implements ReviewReadPolicyContract {
	private readonly _command_policy: CommandPolicyContract;
	private readonly _path_policy: ReviewPathPolicyContract;
	private readonly _cwd: string;
	private readonly _file_value_options: StringSetMap;
	private readonly _recursive_review_search: RecursiveReviewSearchPolicy;

	/** Responsibilities: _command option boundary_. **/
	private option_matches(option_candidate: string, flag: string): boolean {
		if (option_candidate.startsWith(`${flag}=`)) {
			return true;
		}
		return flag.length === 2 && option_candidate.startsWith(flag) && option_candidate.length > flag.length;
	}

	/** Responsibilities: _command option path value_. **/
	private option_value(option_word: string, flag: string): string {
		let value_start = flag.length;
		if (option_word.startsWith(`${flag}=`)) {
			value_start += 1;
		}
		return option_word.slice(value_start);
	}

	/** Responsibilities: _command option path authorization_. **/
	private option_path_allowed(read_command: ReviewReadCommandContext, path_option_word: string): boolean {
		const options = this._file_value_options.get(basename(read_command.command));
		if (options === undefined) {
			return true;
		}
		for (const option of options) {
			if (!this.option_matches(path_option_word, option)) {
				continue;
			}
			const path = this.option_value(path_option_word, option);
			return this._path_policy.allows_path_from(path, read_command.command_cwd);
		}
		return true;
	}

	/** Responsibilities: _command word authorization_. **/
	private allows_read_word(command_context: ReviewReadCommandContext, word_index: number): boolean {
		const word = command_context.words[word_index];
		if (word === undefined) {
			return true;
		}
		if (word.startsWith("-")) {
			return this.option_path_allowed(command_context, word);
		}
		if (command_context.recursive) {
			return this._path_policy.allows_recursive_path(word, command_context.command_cwd);
		}
		return this._path_policy.allows_path_from(word, command_context.command_cwd);
	}

	/** Responsibilities: _command argument authorization_. **/
	private allows_command_words(read_command: ReviewReadCommandContext): boolean {
		for (let word_index = 1; word_index < read_command.words.length; word_index += 1) {
			if (!this.allows_read_word(read_command, word_index)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _policy state_. **/
	public constructor(path_policy: ReviewPathPolicyContract) {
		const unsafe_options = new Set([
			"-c",
			"-delete",
			"-exec",
			"-execdir",
			"-fls",
			"-i",
			"--in-place",
			"--follow",
			"--output",
			"--pre",
			"--pre-glob",
			"-o",
			"-ok",
			"-okdir",
		]);
		const option_policy = new CommandOptionPolicy(unsafe_options, REVIEW_FILES_FROM_OPTION);
		this._command_policy = new CommandPolicy(
			["/bin", "/usr/bin", "/usr/local/bin", "/sbin", "/usr/sbin"],
			new Set([
				"awk",
				"cat",
				"cut",
				"find",
				"grep",
				"head",
				"ls",
				"printf",
				"pwd",
				"readlink",
				"rg",
				"sort",
				"sed",
				"stat",
				"tail",
				"true",
				"wc",
				"which",
			]),
			option_policy,
			new Set(["-H", "-P", "-type", "-name", "-path", "-maxdepth", "-mindepth", "-print", "-print0", "-o"]),
		);
		this._path_policy = path_policy;
		this._cwd = path_policy.project_root();
		this._recursive_review_search = new RecursiveReviewSearchPolicy(path_policy);
		this._file_value_options = new Map([
			["awk", new Set(["-f"])],
			["grep", new Set(["-f", "--file"])],
			["rg", new Set(["-f", "--file", REVIEW_IGNORE_FILE_OPTION])],
			["sed", new Set(["-f"])],
			["sort", new Set([REVIEW_FILES_FROM_OPTION])],
		]);
	}

	/** Responsibilities: _read-only shell classification_. **/
	public read_only(command: string, cwd = "", command_cwd = ""): boolean {
		const body = command.trim();
		if (body === "pwd") {
			return true;
		}
		let effective_command_cwd = this._cwd;
		if (cwd !== "") {
			effective_command_cwd = cwd;
		}
		if (command_cwd !== "") {
			effective_command_cwd = command_cwd;
		}
		const shell_command = new ReviewShellCommand(body, effective_command_cwd, this._command_policy, this);
		if (!shell_command.safe_syntax()) {
			return false;
		}
		return shell_command.safe_segments();
	}

	/** Responsibilities: _command working directory resolution_. **/
	public command_working_directory(workdir: string): string {
		if (workdir === "") {
			return this._cwd;
		}
		if (!this._path_policy.allows_read_path(workdir)) {
			return "";
		}
		return resolve(this._cwd, workdir);
	}

	/** Responsibilities: _command access policy_. **/
	public allows_read_command(command_name: string, words: readonly string[], command_cwd: string): boolean {
		let effective_command_cwd = command_cwd;
		if (effective_command_cwd === "") {
			effective_command_cwd = this._cwd;
		}
		if (this._recursive_review_search.blocks(command_name, words, effective_command_cwd)) {
			return false;
		}
		return this.allows_command_words({
			command: command_name,
			words,
			command_cwd: effective_command_cwd,
			recursive: this._recursive_review_search.recursive(command_name, words),
		});
	}

	/** Responsibilities: _read-only shell decision_. **/
	public decision(shell_command: string, cwd = "", command_cwd = ""): HookDecision {
		if (this.read_only(shell_command, cwd, command_cwd)) {
			return { allowed: true, reason: "" };
		}
		return {
			allowed: false,
			reason:
				"Only read-only shell commands are allowed during architecture review. Allowed: awk, cat, cut, find, grep, head, ls, printf, pwd, readlink, rg, sort, sed, stat, tail, true, wc, and which. Git is not allowed. Read-only commands may be chained with &&, ||, |, or ;. Keep paths inside the project root; do not use find .., writes, redirection, command substitution, background execution, interpreters, or write-capable options.",
		};
	}
}
