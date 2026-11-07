import type {
	CallableReviewAgentResultResolver,
	ReviewAgentAsyncOutput,
	ReviewAgentChildProcessContract,
	ReviewAgentProcessStateContract,
	ReviewAgentProcessTerminatorContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _process outcome state_, _timeout escalation state_. **/
export type ReviewAgentProcessCloseContext = {
	readonly state: ReviewAgentProcessStateContract;
	readonly child: ReviewAgentChildProcessContract;
	readonly terminator: ReviewAgentProcessTerminatorContract;
	readonly output: ReviewAgentAsyncOutput;
	readonly timed_out: boolean;
	readonly escalation_finished: boolean;
	readonly process_closed: boolean;
	readonly closed_exit_status: number;
};

/** Responsibilities: _initial child-close state inputs_. **/
export type ReviewAgentProcessInitialCloseContext = {
	readonly timer: ReturnType<typeof setTimeout>;
	readonly child: ReviewAgentChildProcessContract;
	readonly terminator: ReviewAgentProcessTerminatorContract;
	readonly settle_result: CallableReviewAgentResultResolver;
};

/** Responsibilities: _reported exit status_, _missing exit status_. **/
export type ReviewAgentProcessExitCodeState = {
	readonly received: boolean;
	readonly code: number;
};

/** Responsibilities: _immutable process exit states_, _timeout settlement_. **/
export interface ReviewAgentProcessCloseStateContract {
	record_error(message: string): ReviewAgentProcessCloseStateContract;
	record_close(
		exit_status: ReviewAgentProcessExitCodeState,
		output: ReviewAgentAsyncOutput,
	): ReviewAgentProcessCloseStateContract;
	begin_timeout(): ReviewAgentProcessCloseStateContract;
	terminate_for_timeout(): void;
	track_escalation(timer: ReturnType<typeof setTimeout>): ReviewAgentProcessCloseStateContract;
	finish_escalation(): ReviewAgentProcessCloseStateContract;
}

export type ReviewAgentProcessCloseSnapshot = {
	context: ReviewAgentProcessCloseContext;
	exit_code_state: ReviewAgentProcessExitCodeState;
};

export type ReviewAgentProcessCloseStateCell = {
	value: ReviewAgentProcessCloseSnapshot;
};
