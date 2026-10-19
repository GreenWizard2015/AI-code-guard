import type { HookDecision } from "src/model/types/types";
import {
	SHELL_ESCAPE_AMPERSAND,
	SHELL_ESCAPE_CARRIAGE_RETURN,
	SHELL_ESCAPE_NEWLINE,
	SHELL_ESCAPE_PIPE,
	SHELL_ESCAPE_SEMICOLON,
} from "src/core/support/task/review-agent/constants";
import { CommandPolicy } from "src/core/support/task/review-agent/policy/command_policy";
import type {
	CommandPolicyContract,
	ReviewPathPolicyContract,
	ReviewReadPolicyContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _read-only shell classification_, _read-only shell authorization_. **/
export class ReviewReadPolicy implements ReviewReadPolicyContract {
	private readonly command_policy: CommandPolicyContract;
	private readonly path_policy: ReviewPathPolicyContract;

	/** Responsibilities: _shell command safety_. **/
	private safe_command(words: readonly string[]): boolean {
		const command_name = words[0];
		if (!this.command_policy.supported(command_name)) {
			return false;
		}
		return this.command_policy.arguments_safe(words);
	}

	/** Responsibilities: _shell expansion prevention_. **/
	private has_shell_expansion(command: string): boolean {
		if (command.includes("$")) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _shell quote-boundary validation_. **/
	private command_character(command: string, index: number): string {
		const character = command[index];
		if (character === undefined) {
			return "";
		}
		return character;
	}

	/** Responsibilities: _shell quote-boundary validation_. **/
	private quote_is_concatenated(command: string, index: number, quote: string): boolean {
		if (quote === "") {
			const previous = this.command_character(command, index - 1);
			if (previous === "") {
				return false;
			}
			return /\S/u.test(previous);
		}
		const next = this.command_character(command, index + 1);
		if (next === "") {
			return false;
		}
		return /\S/u.test(next);
	}

	/** Responsibilities: _shell quote state transition_. **/
	private next_quote(character: string, quote: string): string {
		if (quote === "") {
			return character;
		}
		return "";
	}

	/** Responsibilities: _shell quote-boundary validation_. **/
	private has_concatenated_quotes(command: string): boolean {
		let quote = "";
		for (let index = 0; index < command.length; index += 1) {
			const character = this.command_character(command, index);
			if (character !== "'" && character !== '"') {
				continue;
			}
			if (this.quote_is_concatenated(command, index, quote)) {
				return true;
			}
			quote = this.next_quote(character, quote);
		}
		return quote !== "";
	}

	/** Responsibilities: _unquoted glob prevention_. **/
	private has_unquoted_glob(command: string): boolean {
		let quote = "";
		for (const character of command) {
			if (quote !== "") {
				if (character === quote) {
					quote = "";
				}
				continue;
			}
			if (character === "'" || character === '"') {
				quote = character;
				continue;
			}
			if (character === "*" || character === "?" || character === "[") {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _shell word parsing_. **/
	private shell_words(segment: string): string[] {
		const matches = segment.match(/'[^']*'|"[^"]*"|\S+/gu);
		if (matches === null) {
			return [];
		}
		return matches.map((word) => this.unquote_word(word));
	}

	/** Responsibilities: _shell quote removal_. **/
	private unquote_word(word: string): string {
		if (word.length < 2) {
			return word;
		}
		const first = word.at(0);
		const last = word.at(-1);
		if ((first === "'" || first === '"') && first === last) {
			return word.slice(1, -1);
		}
		return word;
	}

	/** Responsibilities: _shell syntax exclusion_. **/
	private unsafe_syntax(command: string, unquoted_command: string): boolean {
		if (unquoted_command.includes("\\") || unquoted_command.includes("~")) {
			return true;
		}
		if (this.has_shell_expansion(command)) {
			return true;
		}
		return unquoted_command.includes(">") || unquoted_command.includes("<");
	}

	/** Responsibilities: _shell substitution exclusion_. **/
	private unsafe_substitution(command: string, unquoted_command: string): boolean {
		if (command.includes("`") || command.includes("$(") || command.includes("${")) {
			return true;
		}
		return unquoted_command.replaceAll("&&", "").includes("&");
	}

	/** Responsibilities: _shell syntax validation_. **/
	private safe_syntax(command: string): boolean {
		if (this.has_concatenated_quotes(command) || this.has_unquoted_glob(command)) {
			return false;
		}
		const unquoted_command = command.replace(/'[^']*'|"[^"]*"/gu, "");
		if (this.unsafe_syntax(command, unquoted_command)) {
			return false;
		}
		return !this.unsafe_substitution(command, unquoted_command);
	}

	/** Responsibilities: _shell segment validation_. **/
	private safe_segment(segment: string, cwd: string, command_cwd: string): boolean {
		const words = this.shell_words(segment);
		if (words.length === 0) {
			return false;
		}
		if (!this.safe_command(words)) {
			return false;
		}
		let command_name = "";
		for (const word of words) {
			command_name = word;
			break;
		}
		if (command_name === "") {
			return false;
		}
		return this.path_policy.allows_read_command(command_name, words, cwd, command_cwd);
	}

	/** Responsibilities: _shell segment parsing_. **/
	private shell_segments(command: string): string[] {
		const protected_command = command.replace(/'[^']*'|"[^"]*"/gu, (quoted) => {
			return quoted
				.replaceAll("&", SHELL_ESCAPE_AMPERSAND)
				.replaceAll("|", SHELL_ESCAPE_PIPE)
				.replaceAll(";", SHELL_ESCAPE_SEMICOLON)
				.replaceAll("\r", SHELL_ESCAPE_CARRIAGE_RETURN)
				.replaceAll("\n", SHELL_ESCAPE_NEWLINE);
		});
		const segments = protected_command.split(/\s*(?:&&|\|\|?|\||;|\r?\n)\s*/u);
		for (const segment of segments) {
			if (segment.trim() === "") {
				return [];
			}
		}
		return segments.map((segment) =>
			segment
				.replaceAll(SHELL_ESCAPE_AMPERSAND, "&")
				.replaceAll(SHELL_ESCAPE_PIPE, "|")
				.replaceAll(SHELL_ESCAPE_SEMICOLON, ";")
				.replaceAll(SHELL_ESCAPE_CARRIAGE_RETURN, "\r")
				.replaceAll(SHELL_ESCAPE_NEWLINE, "\n"),
		);
	}

	/** Responsibilities: _read-only shell classification_. **/
	private safe_segments(command: string, cwd: string, command_cwd: string): boolean {
		const segments = this.shell_segments(command);
		if (segments.length === 0) {
			return false;
		}
		for (const segment of segments) {
			if (!this.safe_segment(segment, cwd, command_cwd)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _policy state_. **/
	public constructor(path_policy: ReviewPathPolicyContract) {
		this.command_policy = new CommandPolicy();
		this.path_policy = path_policy;
	}

	/** Responsibilities: _read-only shell classification_. **/
	public read_only(command: string, cwd = "", command_cwd = ""): boolean {
		let effective_command_cwd = cwd;
		if (command_cwd !== "") {
			effective_command_cwd = command_cwd;
		}
		const body = command.trim();
		if (body.trim() === "pwd") {
			return true;
		}
		if (!this.safe_syntax(body)) {
			return false;
		}
		return this.safe_segments(body, cwd, effective_command_cwd);
	}

	/** Responsibilities: _read-only shell authorization_. **/
	public decision(command: string, cwd = "", command_cwd = ""): HookDecision {
		if (this.read_only(command, cwd, command_cwd)) {
			return { allowed: true, reason: "" };
		}
		return {
			allowed: false,
			reason:
				"Only read-only shell commands are allowed during architecture review. Allowed: awk, cat, cut, find, grep, head, ls, printf, pwd, readlink, rg, sort, sed, stat, tail, true, wc, and which. Git is not allowed. Read-only commands may be chained with &&, ||, |, or ;. Keep paths inside the project root; do not use find .., writes, redirection, command substitution, background execution, interpreters, or write-capable options.",
		};
	}
}
