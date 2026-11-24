import {
	SHELL_ESCAPE_AMPERSAND,
	SHELL_ESCAPE_CARRIAGE_RETURN,
	SHELL_ESCAPE_NEWLINE,
	SHELL_ESCAPE_PIPE,
	SHELL_ESCAPE_SEMICOLON,
} from "src/core/support/task/review-agent/constants";
import type { CommandPolicyContract, ReviewReadPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _shell command parsing_, _read-only command classification_. **/
export class ReviewShellCommand {
	private readonly _command: string;
	private readonly _command_cwd: string;
	private readonly _command_policy: CommandPolicyContract;
	private readonly _read_policy: ReviewReadPolicyContract;

	/** Responsibilities: _quoted argument boundaries_, _unterminated quote detection_. **/
	private has_concatenated_quotes(): boolean {
		const quotes = [...this._command.matchAll(/['"]/gu)];
		if (quotes.length % 2 !== 0) {
			return true;
		}
		return quotes.some((quote, index) => {
			const quote_position = quote.index;
			if (quote_position === undefined) {
				return false;
			}
			const position = quote_position;
			const next_character = this._command[position + 1];
			let adjacent = "";
			if (next_character !== undefined) {
				adjacent = next_character;
			}
			if (index % 2 === 0) {
				const previous_character = this._command[position - 1];
				adjacent = "";
				if (previous_character !== undefined) {
					adjacent = previous_character;
				}
			}
			return /\S/u.test(adjacent);
		});
	}

	/** Responsibilities: _unquoted glob prevention_. **/
	private has_unquoted_glob(): boolean {
		let quote = "";
		for (const character of this._command) {
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

	/** Responsibilities: _shell argument parsing_. **/
	private shell_words(segment: string): string[] {
		const matched_words = segment.match(/'[^']*'|"[^"]*"|\S+/gu);
		let matches: string[] = [];
		if (matched_words !== null) {
			matches = matched_words;
		}
		return matches.map((word) => {
			if (word.length < 2) {
				return word;
			}
			const first = word.at(0);
			if ((first === "'" || first === '"') && first === word.at(-1)) {
				return word.slice(1, -1);
			}
			return word;
		});
	}

	/** Responsibilities: _shell segment parsing_. **/
	private shell_segments(): string[] {
		const protected_command = this._command.replace(/'[^']*'|"[^"]*"/gu, (quoted) =>
			quoted
				.replaceAll("&", SHELL_ESCAPE_AMPERSAND)
				.replaceAll("|", SHELL_ESCAPE_PIPE)
				.replaceAll(";", SHELL_ESCAPE_SEMICOLON)
				.replaceAll("\r", SHELL_ESCAPE_CARRIAGE_RETURN)
				.replaceAll("\n", SHELL_ESCAPE_NEWLINE),
		);
		const segments = protected_command.split(/\s*(?:&&|\|\|?|\||;|\r?\n)\s*/u);
		if (segments.some((segment) => segment.trim() === "")) {
			return [];
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

	/** Responsibilities: _shell input ownership_. **/
	public constructor(
		command: string,
		command_cwd: string,
		command_policy: CommandPolicyContract,
		read_policy: ReviewReadPolicyContract,
	) {
		this._command = command;
		this._command_cwd = command_cwd;
		this._command_policy = command_policy;
		this._read_policy = read_policy;
	}

	/** Responsibilities: _shell segment authorization_. **/
	public safe_segments(): boolean {
		const segments = this.shell_segments();
		if (segments.length === 0) {
			return false;
		}
		for (const segment of segments) {
			const words = this.shell_words(segment);
			if (words.length === 0 || !this._command_policy.arguments_safe(words)) {
				return false;
			}
			const command = words.at(0);
			if (command === undefined || !this._read_policy.allows_read_command(command, words, this._command_cwd)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _shell syntax validation_. **/
	public safe_syntax(): boolean {
		if (this.has_concatenated_quotes() || this.has_unquoted_glob()) {
			return false;
		}
		const unquoted_command = this._command.replace(/'[^']*'|"[^"]*"/gu, "");
		if (unquoted_command.includes("\\") || unquoted_command.includes("~") || this._command.includes("$")) {
			return false;
		}
		if (unquoted_command.includes(">") || unquoted_command.includes("<")) {
			return false;
		}
		if (this._command.includes("`") || this._command.includes("$(") || this._command.includes("${")) {
			return false;
		}
		return !unquoted_command.replaceAll("&&", "").includes("&");
	}
}
