import { ReviewAgentProcessState } from "src/core/support/task/review-agent/process/review_agent_process_state";
import type {
	ReviewAgentProcessCloseContext,
	ReviewAgentProcessCloseStateContract,
	ReviewAgentProcessExitCodeState,
	ReviewAgentProcessInitialCloseContext,
} from "src/core/support/task/review-agent/process/types";
import type { ReviewAgentProcessCloseStateCell } from "src/core/support/task/review-agent/process/types";
import type { ReviewAgentAsyncOutput } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _process exit transitions_, _timeout settlement_. **/
export class ReviewAgentProcessCloseState implements ReviewAgentProcessCloseStateContract {
	private readonly _state: ReviewAgentProcessCloseStateCell;

	/** Responsibilities: _exit state initialization_. **/
	public constructor(context: ReviewAgentProcessInitialCloseContext) {
		const process_state = new ReviewAgentProcessState(
			{ timer: context.timer, escalation_timers: [], failure_messages: [] },
			context.settle_result,
		);
		const close_context: ReviewAgentProcessCloseContext = {
			state: process_state,
			child: context.child,
			terminator: context.terminator,
			output: { stdout: "", stderr: "" },
			timed_out: false,
			escalation_finished: false,
			process_closed: false,
			closed_exit_status: 1,
		};
		this._state = { value: { context: close_context, exit_code_state: { received: false, code: 1 } } };
	}

	/** Responsibilities: _process error transition_. **/
	public record_error(message: string): ReviewAgentProcessCloseStateContract {
		const context = this._state.value.context;
		this._state.value.context = { ...context, state: context.state.error_state(message) };
		return this;
	}

	/** Responsibilities: _process exit recording_. **/
	public record_close(
		exit_status: ReviewAgentProcessExitCodeState,
		output: ReviewAgentAsyncOutput,
	): ReviewAgentProcessCloseStateContract {
		const current = this._state.value;
		const context = current.context;
		this._state.value = {
			context: {
				...context,
				process_closed: true,
				closed_exit_status: exit_status.code,
				output,
			},
			exit_code_state: exit_status,
		};
		if (!context.timed_out || context.escalation_finished) {
			context.state.complete(exit_status.code, output);
		}
		return this;
	}

	/** Responsibilities: _timeout transition_. **/
	public begin_timeout(): ReviewAgentProcessCloseStateContract {
		const context = this._state.value.context;
		this._state.value.context = {
			...context,
			state: context.state.timed_out_state(),
			timed_out: true,
		};
		return this;
	}

	/** Responsibilities: _timeout termination request_. **/
	public terminate_for_timeout(): void {
		const context = this._state.value.context;
		context.terminator.terminate(context.child, "SIGTERM");
	}

	/** Responsibilities: _escalation timer tracking_. **/
	public track_escalation(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessCloseStateContract {
		const context = this._state.value.context;
		this._state.value.context = { ...context, state: context.state.escalation_state(timer) };
		return this;
	}

	/** Responsibilities: _escalation completion_. **/
	public finish_escalation(): ReviewAgentProcessCloseStateContract {
		const current = this._state.value;
		const context = current.context;
		context.terminator.terminate(context.child, "SIGKILL");
		if (context.process_closed) {
			context.state.complete(current.exit_code_state.code, context.output);
		}
		this._state.value.context = { ...context, escalation_finished: true };
		return this;
	}
}
