import type { CommandOptionPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _command argument validation_, _command-specific argument safety_. **/
export class CommandArguments {
	private readonly _words: readonly string[];
	private readonly _command: string;
	private readonly _option_policy: CommandOptionPolicyContract;
	private readonly _find_options: ReadonlySet<string>;

	/** Responsibilities: _awk expression validation_. **/
	private awk_expression(): boolean {
		const script = this._words[1];
		if (script === undefined) {
			return false;
		}
		const expression = script.replaceAll(" ", "");
		return /^(?:\{print\}|NR(?:<=|>=|==)\d+\{print\}|NR>=\d+&&NR<=\d+\{print\})$/u.test(expression);
	}

	/** Responsibilities: _sed expression validation_. **/
	private sed_expression(): boolean {
		const script = this._words.slice(1).find((word) => !word.startsWith("-"));
		if (script === undefined) {
			return false;
		}
		const normalized_script = script.replaceAll("'", "").replaceAll('"', "");
		return /^\$?\d+(,\$?\d+)?p$/u.test(normalized_script);
	}

	/** Responsibilities: _predicate option membership_. **/
	private predicate_options_safe(): boolean {
		for (const word of this._words.slice(1)) {
			if (!word.startsWith("-")) {
				continue;
			}
			if (!this._find_options.has(word)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _command option validation_. **/
	private options_safe(): boolean {
		if (!this._option_policy.generic_arguments_safe(this._words, this.name())) {
			return false;
		}
		return this._option_policy.special_arguments_safe(this._words, this.name());
	}

	/** Responsibilities: _special command validation_. **/
	private special_command(): boolean {
		const command_name = this.name();
		if (command_name === "awk") {
			return this.awk_expression();
		}
		if (command_name === "sed") {
			return this.sed_expression();
		}
		if (command_name === "find") {
			return this.predicate_options_safe();
		}
		return true;
	}

	/** Responsibilities: _argument policy initialization_. **/
	public constructor(
		words: readonly string[],
		option_policy: CommandOptionPolicyContract,
		find_options: ReadonlySet<string>,
	) {
		this._words = words;
		const command = words.at(0);
		this._command = "";
		if (command !== undefined) {
			this._command = command;
		}
		this._option_policy = option_policy;
		this._find_options = find_options;
	}

	/** Responsibilities: _command identity access_. **/
	public name(): string {
		if (this._command.length === 0) {
			return "";
		}
		const separator_index = this._command.lastIndexOf("/");
		if (separator_index < 0) {
			return this._command;
		}
		return this._command.slice(separator_index + 1);
	}

	/** Responsibilities: _command arguments safety_. **/
	public safe(): boolean {
		if (this.name() === "") {
			return false;
		}
		if (!this.options_safe()) {
			return false;
		}
		return this.special_command();
	}
}
