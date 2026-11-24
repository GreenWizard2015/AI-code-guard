/** Responsibilities: _shell command option classification_, _write-capable option detection_. **/
export class CommandOption {
	private readonly _word: string;
	private readonly _command_name: string;
	private readonly _unsafe_tokens: ReadonlySet<string>;
	private readonly _files_from_option: string;

	/** Responsibilities: _ripgrep symlink traversal prevention_. **/
	private rg_follow_option(): boolean {
		if (this._word === "-L") {
			return true;
		}
		if (this._word.startsWith("--")) {
			return false;
		}
		return this._word.startsWith("-") && this._word.slice(1).includes("L");
	}

	/** Responsibilities: _grep recursive dereference prevention_. **/
	private grep_unsafe_option(): boolean {
		if (this._word === "--dereference-recursive") {
			return true;
		}
		if (!this._word.startsWith("-") || this._word.startsWith("--")) {
			return false;
		}
		return this._word.slice(1).includes("R");
	}

	/** Responsibilities: _output option restrictions_. **/
	private sort_option(): boolean {
		if (!this._word.startsWith("-")) {
			return false;
		}
		if (this._word === this._files_from_option || this._word.startsWith("--files0-from=")) {
			return true;
		}
		if (this._word === "--compress-program" || this._word.startsWith("--compress-program=")) {
			return true;
		}
		if (this._word.startsWith("--")) {
			return false;
		}
		return this._word.slice(1).includes("o");
	}

	/** Responsibilities: _sed script execution prevention_. **/
	private sed_unsafe_option(): boolean {
		if (this._word === "-e" || this._word.startsWith("-e")) {
			return true;
		}
		if (this._word.startsWith("--expression")) {
			return true;
		}
		if (this._word === "-f" || this._word.startsWith("-f")) {
			return true;
		}
		return this._word.startsWith("--file");
	}

	/** Responsibilities: _option classification state_. **/
	public constructor(
		word: string,
		command_name: string,
		unsafe_tokens: ReadonlySet<string>,
		files_from_option: string,
	) {
		this._word = word;
		this._command_name = command_name;
		this._unsafe_tokens = unsafe_tokens;
		this._files_from_option = files_from_option;
	}

	/** Responsibilities: _generic command option classification_. **/
	public generic_unsafe(): boolean {
		if (this._unsafe_tokens.has(this._word)) {
			return true;
		}
		if (this._word.startsWith("--output=") || this._word.startsWith("--in-place=")) {
			return true;
		}
		if (this._word.startsWith("--pre=") || this._word.startsWith("--pre-glob=")) {
			return true;
		}
		if (this._word.startsWith("-i") || this._word.startsWith("-o")) {
			return true;
		}
		return this._word.startsWith("-fprint") || this._word.startsWith("-fprintf");
	}

	/** Responsibilities: _command-specific option classification_. **/
	public command_unsafe(): boolean {
		if (this._command_name === "rg") {
			return this.rg_follow_option();
		}
		if (this._command_name === "grep") {
			return this.grep_unsafe_option();
		}
		if (this._command_name === "sort") {
			return this.sort_option();
		}
		if (this._command_name === "sed") {
			return this.sed_unsafe_option();
		}
		return false;
	}
}
