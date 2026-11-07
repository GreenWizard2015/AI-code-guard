import type { ReviewAgentHooksContract } from "src/core/support/task/review-agent/protocols";
import type { HookDecision } from "src/model_types";
import type { ReviewAgentHookEvent } from "src/task_review_types";

/** Responsibilities: _hook event recording_, _hook decision provision_. **/
export class StubReviewHooks implements ReviewAgentHooksContract {
	private readonly _events: ReviewAgentHookEvent[];
	private readonly _decision: HookDecision;
	private _stop_fails = false;
	private _stop_failure_stage = "";

	/** Responsibilities: _review-agent hook event recording_. **/
	private record(event: ReviewAgentHookEvent): HookDecision {
		this._events.push(event);
		return this._decision;
	}

	/** Responsibilities: _hook fixture state initialization_. **/
	public constructor() {
		this._events = [];
		this._decision = { allowed: true, reason: "" };
	}

	/** Responsibilities: _review-agent lifecycle hook fixture_. **/
	public run(event: ReviewAgentHookEvent): HookDecision {
		if (this._stop_fails && event.context.event === "agent_stop") {
			return { allowed: false, reason: "stop hook failed" };
		}
		if (this._stop_failure_stage.length > 0) {
			if (event.context.event === "agent_stop") {
				if (event.context.review_stage === this._stop_failure_stage) {
					return { allowed: false, reason: `stop hook failed for ${this._stop_failure_stage}` };
				}
			}
		}
		return this.record(event);
	}

	/** Responsibilities: _global stop-hook rejection fixture_. **/
	public reject_stop_events(): void {
		this._stop_fails = true;
	}

	/** Responsibilities: _stage stop-hook rejection fixture_. **/
	public reject_stage_stop(stage: string): void {
		this._stop_failure_stage = stage;
	}
}
