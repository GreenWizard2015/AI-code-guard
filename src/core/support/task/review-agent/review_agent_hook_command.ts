import { REVIEW_PHASE_ARGUMENT, REVIEW_PREFIX_ARGUMENT } from "src/core/support/task/review-agent/constants";

/** Responsibilities: _hook command argument encoding_, _provider command serialization_. **/
export class ReviewAgentHookCommand {
	private readonly hook_command: string;
	private readonly hook_file: string;
	private readonly review_prefix: string;
	private readonly review_phase: string;

	/** Responsibilities: _hook command initialization_. **/
	public constructor(hook_command: string, hook_file: string, review_prefix: string, review_phase = "initial") {
		this.hook_command = hook_command;
		this.hook_file = hook_file;
		this.review_prefix = review_prefix;
		this.review_phase = review_phase;
	}

	/** Responsibilities: _hook command arguments_. **/
	public arguments(): readonly string[] {
		return [
			this.hook_command,
			this.hook_file,
			REVIEW_PREFIX_ARGUMENT,
			this.review_prefix,
			REVIEW_PHASE_ARGUMENT,
			this.review_phase,
		];
	}

	/** Responsibilities: _provider hook command_. **/
	public command(): string {
		const quoted: string[] = [];
		for (const value of this.arguments()) {
			quoted.push(`'${value.replaceAll("'", "'\"'\"'")}'`);
		}
		return quoted.join(" ");
	}
}
