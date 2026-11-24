import { REVIEW_AGENT_TIMEOUT_MESSAGE } from "src/core/support/task/review-agent/constants";
import type {
	CallableReviewAgentResultResolver,
	ReviewAgentAsyncOutput,
	ReviewAgentProcessStateContextData,
	ReviewAgentProcessStateContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _terminal process outcomes_, _review-agent completion settlement_. **/
export class ReviewAgentProcessState implements ReviewAgentProcessStateContract {
	private readonly _resolve_result: CallableReviewAgentResultResolver;
	private readonly _timer: ReturnType<typeof setTimeout>;
	private readonly _escalation_timers: readonly ReturnType<typeof setTimeout>[];
	private readonly _failure_messages: readonly string[];

	/** Responsibilities: _review-agent process state initialization_. **/
	public constructor(context: ReviewAgentProcessStateContextData, resolve_result: CallableReviewAgentResultResolver) {
		this._resolve_result = resolve_result;
		this._timer = context.timer;
		this._escalation_timers = context.escalation_timers;
		this._failure_messages = context.failure_messages;
	}

	/** Responsibilities: _review-agent timeout transition_. **/
	public timed_out_state(): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(
			{
				timer: this._timer,
				escalation_timers: this._escalation_timers,
				failure_messages: [...this._failure_messages, REVIEW_AGENT_TIMEOUT_MESSAGE],
			},
			this._resolve_result,
		);
	}

	/** Responsibilities: _review-agent error transition_. **/
	public error_state(message: string): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(
			{
				timer: this._timer,
				escalation_timers: this._escalation_timers,
				failure_messages: [...this._failure_messages, message],
			},
			this._resolve_result,
		);
	}

	/** Responsibilities: _review-agent escalation transition_. **/
	public escalation_state(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessStateContract {
		return new ReviewAgentProcessState(
			{
				timer: this._timer,
				escalation_timers: [...this._escalation_timers, timer],
				failure_messages: this._failure_messages,
			},
			this._resolve_result,
		);
	}

	/** Responsibilities: _review-agent process completion_. **/
	public complete(exit_code: number, output: ReviewAgentAsyncOutput): void {
		clearTimeout(this._timer);
		const timed_out = this._failure_messages.includes(REVIEW_AGENT_TIMEOUT_MESSAGE);
		if (!timed_out) {
			for (const timer of this._escalation_timers) {
				clearTimeout(timer);
			}
		}
		const stderr = `${output.stderr}${this._failure_messages.join("\n")}`;
		let exit_status = exit_code;
		if (this._failure_messages.length > 0) {
			exit_status = 1;
		}
		this._resolve_result({ exit_code: exit_status, stdout: output.stdout, stderr });
	}
}
