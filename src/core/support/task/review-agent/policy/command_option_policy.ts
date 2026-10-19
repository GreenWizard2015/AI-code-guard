import { REVIEW_FILES_FROM_OPTION } from "src/core/support/task/review-agent/constants";

/** Responsibilities: _command option safety_, _safe read-option classification_. **/
export class CommandOptionPolicy {
	private readonly unsafe_tokens: Set<string>;

	/** Responsibilities: _ripgrep symlink traversal prevention_. **/
	private rg_follow_option(word: string): boolean {
		if (word === "-L") {
			return true;
		}
		if (word.startsWith("--")) {
			return false;
		}
		return word.startsWith("-") && word.slice(1).includes("L");
	}

	/** Responsibilities: _grep recursive dereference prevention_. **/
	private grep_unsafe_option(word: string): boolean {
		if (word === "--dereference-recursive") {
			return true;
		}
		if (!word.startsWith("-") || word.startsWith("--")) {
			return false;
		}
		return word.slice(1).includes("R");
	}

	/** Responsibilities: _command option policy_. **/
	private sort_option(word: string): boolean {
		if (word.startsWith("-")) {
			if (!word.startsWith("--") && word.slice(1).includes("o")) {
				return true;
			}
		}
		if (word === REVIEW_FILES_FROM_OPTION) {
			return true;
		}
		if (word.startsWith("--files0-from=")) {
			return true;
		}
		if (word === "--compress-program") {
			return true;
		}
		return word.startsWith("--compress-program=");
	}

	/** Responsibilities: _sed script safety_. **/
	private sed_unsafe_option(word: string): boolean {
		if ((word === "-e") || word.startsWith("-e")) {
			return true;
		}
		if (word.startsWith("--expression")) {
			return true;
		}
		if ((word === "-f") || word.startsWith("-f")) {
			return true;
		}
		return word.startsWith("--file");
	}

	/** Responsibilities: _command-specific unsafe option detection_. **/
	private special_unsafe_option(word: string, command_name: string): boolean {
		if (command_name === "rg") {
			return this.rg_follow_option(word);
		}
		if (command_name === "grep") {
			return this.grep_unsafe_option(word);
		}
		if (command_name === "sort") {
			return this.sort_option(word);
		}
		if (command_name !== "sed") {
			return false;
		}
		return this.sed_unsafe_option(word);
	}

	/** Responsibilities: _generic unsafe option detection_. **/
	private generic_unsafe_option(word: string): boolean {
		if (this.unsafe_tokens.has(word)) {
			return true;
		}
		if (word.startsWith("--output=") || word.startsWith("--in-place=")) {
			return true;
		}
		if (word.startsWith("--pre=") || word.startsWith("--pre-glob=")) {
			return true;
		}
		if (word.startsWith("-i") || word.startsWith("-o")) {
			return true;
		}
		return word.startsWith("-fprint") || word.startsWith("-fprintf");
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.unsafe_tokens = new Set([
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
	}

	/** Responsibilities: _generic option safety_. **/
	public generic_arguments_safe(words: readonly string[], command_name: string): boolean {
		for (const word of words) {
			if (command_name === "find" && word === "-o") {
				continue;
			}
			if (this.generic_unsafe_option(word)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _special option safety_. **/
	public special_arguments_safe(words: readonly string[], command_name: string): boolean {
		for (const word of words) {
			if (this.special_unsafe_option(word, command_name)) {
				return false;
			}
		}
		return true;
	}
}
