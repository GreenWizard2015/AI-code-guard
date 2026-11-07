import { CommandOption } from "src/core/support/task/review-agent/policy/command_option";
import type { CommandOptionPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _generic option validation_, _command-specific option validation_. **/
export class CommandOptionPolicy implements CommandOptionPolicyContract {
	private readonly _unsafe_tokens: ReadonlySet<string>;
	private readonly _files_from_option: string;

	/** Responsibilities: _option policy state_. **/
	public constructor(unsafe_tokens: ReadonlySet<string>, files_from_option: string) {
		this._unsafe_tokens = unsafe_tokens;
		this._files_from_option = files_from_option;
	}

	/** Responsibilities: _generic option safety_. **/
	public generic_arguments_safe(words: readonly string[], command_name: string): boolean {
		for (const word of words) {
			if (command_name === "find" && word === "-o") {
				continue;
			}
			const option = new CommandOption(word, command_name, this._unsafe_tokens, this._files_from_option);
			if (option.generic_unsafe()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _special option safety_. **/
	public special_arguments_safe(words: readonly string[], command_name: string): boolean {
		for (const word of words) {
			const option = new CommandOption(word, command_name, this._unsafe_tokens, this._files_from_option);
			if (option.command_unsafe()) {
				return false;
			}
		}
		return true;
	}
}
