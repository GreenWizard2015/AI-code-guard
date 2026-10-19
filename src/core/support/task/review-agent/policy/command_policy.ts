import { CommandOptionPolicy } from "src/core/support/task/review-agent/policy/command_option_policy";

/** Responsibilities: _trusted command validation_, _argument safety policy_. **/
export class CommandPolicy {
	private readonly trusted_command_directories = ["/bin", "/usr/bin", "/usr/local/bin", "/sbin", "/usr/sbin"];
	private readonly read_commands: Set<string>;
	private readonly option_policy: CommandOptionPolicy;
	private readonly find_options: Set<string>;

	/** Responsibilities: _command path normalization_. **/
	private command_name(words: readonly string[]): string {
		const command = words.at(0);
		if (command === undefined) {
			return "";
		}
		return command.slice(command.lastIndexOf("/") + 1);
	}

	/** Responsibilities: _trusted executable identity_. **/
	private trusted_executable(command: string, name: string): boolean {
		if (!command.includes("/")) {
			return true;
		}
		for (const directory of this.trusted_command_directories) {
			if (command === `${directory}/${name}`) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _awk expression_. **/
	private awk_expression(words: readonly string[]): boolean {
		const script = words[1];
		if (script === undefined) {
			return false;
		}
		const expression = script.replaceAll(" ", "");
		return /^(?:\{print\}|NR(?:<=|>=|==)\d+\{print\}|NR>=\d+&&NR<=\d+\{print\})$/u.test(expression);
	}

	/** Responsibilities: _sed expression_. **/
	private sed_expression(words: readonly string[]): boolean {
		const script = words.slice(1).find((word) => !word.startsWith("-"));
		if (script === undefined) {
			return false;
		}
		const normalized_script = script.replaceAll("'", "").replaceAll('"', "");
		return /^\$?\d+(,\$?\d+)?p$/u.test(normalized_script);
	}

	/** Responsibilities: _predicate option safety_. **/
	private predicate_options_safe(words: readonly string[]): boolean {
		for (const word of words.slice(1)) {
			if (!word.startsWith("-")) {
				continue;
			}
			if (!this.find_options.has(word)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _option safety_. **/
	private options_safe(words: readonly string[]): boolean {
		const command_name = this.command_name(words);
		if (command_name === "") {
			return false;
		}
		if (!this.option_policy.generic_arguments_safe(words, command_name)) {
			return false;
		}
		return this.option_policy.special_arguments_safe(words, command_name);
	}

	/** Responsibilities: _special command policy_. **/
	private special_command(command_name: string, words: readonly string[]): boolean {
		if (command_name === "awk") {
			return this.awk_expression(words);
		}
		if (command_name === "sed") {
			return this.sed_expression(words);
		}
		if (command_name === "find") {
			return this.predicate_options_safe(words);
		}
		return true;
	}

	/** Responsibilities: _argument safety_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.read_commands = new Set([
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
		]);
		this.option_policy = new CommandOptionPolicy();
		this.find_options = new Set([
			"-H",
			"-P",
			"-type",
			"-name",
			"-path",
			"-maxdepth",
			"-mindepth",
			"-print",
			"-print0",
			"-o",
		]);
	}
	/** Responsibilities: _public operation_. **/
	public arguments_safe(words: readonly string[]): boolean {
		const command_name = this.command_name(words);
		if (command_name === "") {
			return false;
		}
		if (!this.options_safe(words)) {
			return false;
		}
		return this.special_command(command_name, words);
	}

	/** Responsibilities: _command support_. **/
	public supported(command_name: string): boolean {
		const normalized_command_name = command_name.slice(command_name.lastIndexOf("/") + 1);
		if (!this.read_commands.has(normalized_command_name)) {
			return false;
		}
		if (!this.trusted_executable(command_name, normalized_command_name)) {
			return false;
		}
		return true;
	}
}
