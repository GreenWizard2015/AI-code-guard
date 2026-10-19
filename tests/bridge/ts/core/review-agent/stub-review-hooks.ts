import type { ReviewAgentHooksContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentHookEventContract } from "src/types";
import type { HookDecision } from "src/model/types/types";

/** Responsibilities: _hook event recording_, _hook decision provision_. **/
export class StubReviewHooks implements ReviewAgentHooksContract {
	public readonly events: ReviewAgentHookEventContract[] = [];
	public readonly decision: HookDecision = { allowed: true, reason: "" };
	public stop_fails = false;
	public stop_failure_stage = "";

	/** Responsibilities: _review-agent hook event recording_. **/
	private record(event: ReviewAgentHookEventContract): HookDecision {
		this.events.push(event);
		return this.decision;
	}

	/** Responsibilities: _review-agent lifecycle hook fixture_. **/
	public run(event: ReviewAgentHookEventContract): HookDecision {
		if (this.stop_fails) {
			if (event.event === "agent_stop") {
				return { allowed: false, reason: "stop hook failed" };
			}
		}
		if (this.stop_failure_stage.length > 0) {
			if (event.event === "agent_stop" && event.review_stage === this.stop_failure_stage) {
				return { allowed: false, reason: `stop hook failed for ${this.stop_failure_stage}` };
			}
		}
		return this.record(event);
	}
}
