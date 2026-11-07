import { CommandArguments } from "src/core/support/task/review-agent/policy/command_arguments";
import type { CommandOptionPolicyContract, CommandPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _trusted command validation_, _argument safety policy_. **/
export class CommandPolicy implements CommandPolicyContract {
	private readonly _trusted_command_directories: readonly string[];
	private readonly _read_commands: Set<string>;
	private readonly _option_policy: CommandOptionPolicyContract;
	private readonly _find_options: Set<string>;

	/** Responsibilities: _trusted executable identity_. **/
	private trusted_executable(command: string, name: string): boolean {
		if (!command.includes("/")) {
			return true;
		}
		for (const directory of this._trusted_command_directories) {
			if (command === `${directory}/${name}`) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _command safety policy dependencies_. **/
	public constructor(
		trusted_command_directories: readonly string[],
		read_commands: Set<string>,
		option_policy: CommandOptionPolicyContract,
		find_options: Set<string>,
	) {
		this._trusted_command_directories = trusted_command_directories;
		this._read_commands = read_commands;
		this._option_policy = option_policy;
		this._find_options = find_options;
	}
	/** Responsibilities: _public operation_. **/
	public arguments_safe(words: readonly string[]): boolean {
		const first_word = words[0];
		let command = "";
		if (first_word !== undefined) {
			command = first_word;
		}
		if (!this.supported(command)) {
			return false;
		}
		const arguments_value = new CommandArguments(words, this._option_policy, this._find_options);
		return arguments_value.safe();
	}

	/** Responsibilities: _command support_. **/
	public supported(command_name: string): boolean {
		const normalized_command_name = command_name.slice(command_name.lastIndexOf("/") + 1);
		if (!this._read_commands.has(normalized_command_name)) {
			return false;
		}
		if (!this.trusted_executable(command_name, normalized_command_name)) {
			return false;
		}
		return true;
	}
}
