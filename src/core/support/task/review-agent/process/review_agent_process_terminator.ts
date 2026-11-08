import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type {
	ReviewAgentChildProcessContract,
	ReviewAgentProcessSignalContract,
	ReviewAgentProcessTerminatorContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _review-agent process termination_, _process-group signal delivery_. **/
export class ReviewAgentProcessTerminator implements ReviewAgentProcessTerminatorContract {
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _process_signal: ReviewAgentProcessSignalContract;
	private readonly _platform: NodeJS.Platform;

	/** Responsibilities: _process termination initialization_. **/
	public constructor(
		boundary_failures: SystemFailureClassificationContract,
		process_signal: ReviewAgentProcessSignalContract,
		platform: NodeJS.Platform,
	) {
		this._boundary_failures = boundary_failures;
		this._process_signal = process_signal;
		this._platform = platform;
	}

	/** Responsibilities: _process signal delivery_. **/
	public terminate(child: ReviewAgentChildProcessContract, signal: NodeJS.Signals): void {
		try {
			if (this._platform !== "win32") {
				if (child.identified()) {
					this._process_signal.group_signal(child.identifier(), signal);
					return;
				}
			}
			this._process_signal.child_signal(child, signal);
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
		}
	}

	/** Responsibilities: _owned process-group cleanup_. **/
	public cleanup_owned_group(child: ReviewAgentChildProcessContract, ownership_token: string): boolean {
		if (this._platform === "win32" || !child.identified()) {
			return true;
		}
		const ownership = { id: child.identifier(), token: ownership_token };
		if (!this._process_signal.group_exists({ id: ownership.id })) {
			return true;
		}
		if (!this._process_signal.group_contains_token(ownership)) {
			return false;
		}
		return this._process_signal.terminate_owned_group(ownership);
	}
}
