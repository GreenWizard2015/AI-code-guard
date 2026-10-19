import type {
	ReviewAgentAsyncOutput,
	ReviewAgentProcessStateContract,
	ReviewAgentResultResolver,
} from "src/core/support/task/review-agent/types";
import { REVIEW_AGENT_TIMEOUT_MESSAGE } from "src/core/support/task/review-agent/constants";

/** Responsibilities: _terminal process outcomes_, _review-agent completion settlement_. **/
export class ReviewAgentProcessState implements ReviewAgentProcessStateContract {
	private readonly output: ReviewAgentAsyncOutput;
	private readonly resolve: ReviewAgentResultResolver;
	private readonly timer: ReturnType<typeof setTimeout>;
	private readonly escalation_timers: readonly ReturnType<typeof setTimeout>[];
	private readonly failure_messages: readonly string[];

	/** Responsibilities: _review-agent process state initialization_. **/
	public constructor(
		output: ReviewAgentAsyncOutput,
		resolve: ReviewAgentResultResolver,
		timer: ReturnType<typeof setTimeout>,
		escalation_timers: readonly ReturnType<typeof setTimeout>[],
		failure_messages: readonly string[],
	) {
		this.output = output;
		this.resolve = resolve;
		this.timer = timer;
		this.escalation_timers = escalation_timers;
		this.failure_messages = failure_messages;
	}

	/** Responsibilities: _review-agent timeout transition_. **/
	public timed_out_state(): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(this.output, this.resolve, this.timer, this.escalation_timers, [
			...this.failure_messages,
			REVIEW_AGENT_TIMEOUT_MESSAGE,
		]);
	}

	/** Responsibilities: _review-agent error transition_. **/
	public error_state(message: string): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(this.output, this.resolve, this.timer, this.escalation_timers, [
			...this.failure_messages,
			message,
		]);
	}

	/** Responsibilities: _review-agent escalation transition_. **/
	public escalation_state(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(
			this.output,
			this.resolve,
			this.timer,
			[...this.escalation_timers, timer],
			this.failure_messages,
		);
	}

	/** Responsibilities: _review-agent process completion_. **/
	public complete(exit_code: number): void {
		clearTimeout(this.timer);
		const timed_out = this.failure_messages.includes(REVIEW_AGENT_TIMEOUT_MESSAGE);
		if (!timed_out) {
			for (const timer of this.escalation_timers) {
				clearTimeout(timer);
			}
		}
		const stderr = `${this.output.stderr}${this.failure_messages.join("\n")}`;
		let exit_status = exit_code;
		if (this.failure_messages.length > 0) {
			exit_status = 1;
		}
		this.resolve({ exit_code: exit_status, stdout: this.output.stdout, stderr });
	}
}
