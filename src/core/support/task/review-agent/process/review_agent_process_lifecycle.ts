import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { ReviewAgentOutputBuffer } from "src/core/support/task/review-agent/process/review_agent_output_buffer";
import { ReviewAgentProcessCloseState } from "src/core/support/task/review-agent/process/review_agent_process_close_state";
import type {
	ReviewAgentProcessCloseStateContract,
	ReviewAgentProcessExitCodeState,
} from "src/core/support/task/review-agent/process/types";
import type {
	CallableReviewAgentOutputSnapshotReader,
	CallableReviewAgentResultResolver,
	ReviewAgentChildProcessContract,
	ReviewAgentProcessCleanupContract,
	ReviewAgentProcessExecution,
	ReviewAgentProcessLifecycleContext,
	ReviewAgentProcessLifecycleContract,
	ReviewAgentProcessRegistrationContract,
	ReviewAgentProcessTerminatorContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentProcessCleanupRequest } from "src/core/support/task/review-agent/types";
import type { ReviewAgentProcessResult } from "src/task_review_types";

/** Responsibilities: _process event lifecycle_, _registration cleanup_. **/
export class ReviewAgentProcessLifecycle implements ReviewAgentProcessLifecycleContract {
	private readonly _process_timeout_ms: number;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _terminator: ReviewAgentProcessTerminatorContract;
	private readonly _cleanup: ReviewAgentProcessCleanupContract;
	private readonly _registration: ReviewAgentProcessRegistrationContract;

	/** Responsibilities: _cleanup failure result construction_. **/
	private cleanup_failure(result: ReviewAgentProcessResult, error: string): ReviewAgentProcessResult {
		return {
			exit_code: 1,
			stdout: result.stdout,
			stderr: `${result.stderr}\nReview agent cleanup failed: ${error}`,
		};
	}

	/** Responsibilities: _cleanup response generation_. **/
	private cleanup_result(request: ReviewAgentProcessCleanupRequest): ReviewAgentProcessResult {
		try {
			const cleanup_error = this._cleanup.unregister_agent(request.execution);
			if (cleanup_error.length === 0) {
				return request.result;
			}
			return this.cleanup_failure(request.result, cleanup_error);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this.cleanup_failure(request.result, String(error));
		}
	}

	/** Responsibilities: _unregistered child termination_. **/
	private fail_unregistered_child(
		child: ReviewAgentChildProcessContract,
		resolve_result: CallableReviewAgentResultResolver,
		error: string,
	): void {
		let settled = false;
		let process_error = "";
		child.on_error((error) => {
			process_error = error.message;
		});
		child.on_close(() => {
			if (settled) {
				return;
			}
			settled = true;
			let stderr = `Review agent identity registration failed: ${String(error)}`;
			if (process_error.length > 0) {
				stderr += `; process error: ${process_error}`;
			}
			resolve_result({
				exit_code: 1,
				stdout: "",
				stderr,
			});
		});
		this._terminator.terminate(child, "SIGKILL");
	}

	/** Responsibilities: _timed child process termination_. **/
	private timeout_child(close_state: ReviewAgentProcessCloseStateContract): void {
		close_state.begin_timeout();
		close_state.terminate_for_timeout();
		const escalation_timer = setTimeout(() => close_state.finish_escalation(), 1000);
		close_state.track_escalation(escalation_timer);
	}

	/** Responsibilities: _child process event lifecycle_. **/
	private attach_child_events(
		child: ReviewAgentChildProcessContract,
		settle_result: CallableReviewAgentResultResolver,
		read_output: CallableReviewAgentOutputSnapshotReader,
	): void {
		const close_state = new ReviewAgentProcessCloseState({
			timer: setTimeout(() => this.timeout_child(close_state), this._process_timeout_ms),
			child,
			terminator: this._terminator,
			settle_result,
		});
		child.on_error((error) => {
			close_state.record_error(error.message);
		});
		child.on_close((exit) => {
			const exit_status: ReviewAgentProcessExitCodeState = { received: exit.received, code: exit.code };
			close_state.record_close(exit_status, read_output());
		});
	}

	/** Responsibilities: _lifecycle dependency initialization_. **/
	public constructor(context: ReviewAgentProcessLifecycleContext) {
		this._process_timeout_ms = context.process_timeout_ms;
		this._boundary_failures = context.boundary_failures;
		this._terminator = context.terminator;
		this._cleanup = context.cleanup;
		this._registration = context.registration;
	}

	/** Responsibilities: _child process setup_. **/
	public attach(execution: ReviewAgentProcessExecution, resolve_result: CallableReviewAgentResultResolver): void {
		const registration_error = this._registration.persist(execution);
		if (registration_error.length > 0) {
			this.fail_unregistered_child(execution.child, resolve_result, registration_error);
			return;
		}
		let settled = false;
		const settle_result: CallableReviewAgentResultResolver = (result) => {
			if (settled) {
				return;
			}
			const settled_result = this.cleanup_result({ execution, result });
			settled = true;
			resolve_result(settled_result);
		};
		const output_buffer = new ReviewAgentOutputBuffer();
		const read_output = output_buffer.capture(execution.child);
		this.attach_child_events(execution.child, settle_result, read_output);
	}
}
