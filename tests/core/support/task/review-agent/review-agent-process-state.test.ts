import "src/core/lint_project_context_creator";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ReviewAgentProcessState } from "src/core/support/task/review-agent/review_agent_process_state";

describe("review agent process state", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	test("keeps escalation active after a timed-out leader closes", () => {
		jest.useFakeTimers();
		let descendants_killed = false;
		let result_exit_code = 0;
		const timeout_timer = setTimeout(() => undefined, 10_000);
		const escalation_timer = setTimeout(() => {
			descendants_killed = true;
		}, 1_000);
		const state = new ReviewAgentProcessState(
			{ stdout: "", stderr: "" },
			(result) => {
				result_exit_code = result.exit_code;
			},
			timeout_timer,
			[escalation_timer],
			["Review agent process timed out."],
		);

		state.complete(0);
		jest.advanceTimersByTime(1_000);

		expect({ descendants_killed, result_exit_code }).toEqual({ descendants_killed: true, result_exit_code: 1 });
	});

	test("clears escalation after a normal completion", () => {
		jest.useFakeTimers();
		let descendants_killed = false;
		const timeout_timer = setTimeout(() => undefined, 10_000);
		const escalation_timer = setTimeout(() => {
			descendants_killed = true;
		}, 1_000);
		const state = new ReviewAgentProcessState(
			{ stdout: "", stderr: "" },
			() => undefined,
			timeout_timer,
			[escalation_timer],
			[],
		);

		state.complete(0);
		jest.advanceTimersByTime(1_000);

		expect(descendants_killed).toBe(false);
	});
});
