import type { HookPayload } from "src/model/types/types";
import type { RawHookPayload, RawHookToolInput, ReviewHookPhase } from "src/core/support/task/review-agent/types";

/** Responsibilities: _provider hook payload normalization_, _Codex tool compatibility_. **/
export class HookPayloadNormalizer {
	private readonly review_prefix: string;
	private readonly trusted_review_phase: ReviewHookPhase;

	/** Responsibilities: _provider tool input boundary_. **/
	private tool_input(value: RawHookToolInput): RawHookToolInput {
		if (value === undefined || value === null || typeof value !== "object") {
			return { command: "", cmd: "", file_path: "", path: "", patch: "", workdir: "", shell: "", login: false };
		}
		return value;
	}

	/** Responsibilities: _text field normalization_. **/
	private text(value: string): string {
		if (typeof value === "string") {
			return value;
		}
		return "";
	}

	/** Responsibilities: _Codex command field normalization_. **/
	private command(input: RawHookToolInput): string {
		const command = this.text(input.command);
		if (command.length > 0) {
			return command;
		}
		return this.text(input.cmd);
	}

	/** Responsibilities: _normalizer configuration_. **/
	public constructor(review_prefix: string, review_phase = "initial") {
		this.review_prefix = review_prefix;
		this.trusted_review_phase = review_phase === "cleanup" ? "cleanup" : "initial";
	}

	/** Responsibilities: _provider command tool normalization_. **/
	public normalized_tool_name(value: string): string {
		const name = this.text(value);
		if (name === "exec_command" || name === "command_execution") {
			return "Bash";
		}
		return name;
	}

	/** Responsibilities: _hook payload normalization_. **/
	public normalize(raw: RawHookPayload): HookPayload {
		const input = this.tool_input(raw.tool_input);
		return {
			event: this.text(raw.event),
			hook_event_name: this.text(raw.hook_event_name),
			tool_name: this.normalized_tool_name(raw.tool_name),
			tool_input: {
				command: this.command(input),
				file_path: this.text(input.file_path),
				path: this.text(input.path),
				patch: this.text(input.patch),
				workdir: this.text(input.workdir),
				shell: this.text(input.shell),
				login: input.login === true,
			},
			cwd: this.text(raw.cwd),
			review_stage: this.text(raw.review_stage),
			review_prefix: this.review_prefix,
			review_phase: this.trusted_review_phase,
		};
	}
}
