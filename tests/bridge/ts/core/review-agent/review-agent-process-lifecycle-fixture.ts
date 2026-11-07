import { REVIEW_AGENT_PROCESS_TIMEOUT_MS } from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessCleanupContract,
	ReviewAgentProcessExecution,
	ReviewAgentProcessLifecycleContext,
	ReviewAgentProcessRegistrationContract,
	ReviewAgentProcessTerminatorContract,
} from "src/core/support/task/review-agent/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";

/** Responsibilities: _review-process lifecycle dependencies_, _termination signal observations_. **/
export class ReviewAgentProcessLifecycleFixture
	implements
		ReviewAgentProcessCleanupContract,
		ReviewAgentProcessRegistrationContract,
		ReviewAgentProcessTerminatorContract
{
	private readonly _cleanup_error: string;
	private readonly _registration_error: string;
	private readonly _signals: NodeJS.Signals[];

	/** Responsibilities: _review lifecycle fixture setup_. **/
	public constructor(registration_error = "", cleanup_error = "") {
		this._cleanup_error = cleanup_error;
		this._registration_error = registration_error;
		this._signals = [];
	}

	/** Responsibilities: _process termination signal observation_. **/
	public terminate(_child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void {
		this._signals.push(signal);
	}

	/** Responsibilities: _registration failure simulation_. **/
	public persist(_execution: ReviewAgentProcessExecution): string {
		return this._registration_error;
	}

	/** Responsibilities: _cleanup failure simulation_. **/
	public unregister_agent(_execution: ReviewAgentProcessExecution): string {
		return this._cleanup_error;
	}

	/** Responsibilities: _review-process lifecycle dependencies_. **/
	public context(): ReviewAgentProcessLifecycleContext {
		return {
			process_timeout_ms: REVIEW_AGENT_PROCESS_TIMEOUT_MS,
			boundary_failures: new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES),
			terminator: this,
			cleanup: this,
			registration: this,
		};
	}

	/** Responsibilities: _termination signal results_. **/
	public termination_signals(): readonly NodeJS.Signals[] {
		return [...this._signals];
	}
}
