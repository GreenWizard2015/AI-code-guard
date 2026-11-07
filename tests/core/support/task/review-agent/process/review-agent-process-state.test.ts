import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ReviewAgentOutputBuffer } from "src/core/support/task/review-agent/process/review_agent_output_buffer";
import { ReviewAgentProcessState } from "src/core/support/task/review-agent/process/review_agent_process_state";

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
			{
				timer: timeout_timer,
				escalation_timers: [escalation_timer],
				failure_messages: ["Review agent process timed out."],
			},
			(result) => {
				result_exit_code = result.exit_code;
			},
		);

		const output = new ReviewAgentOutputBuffer();
		state.complete(0, output.snapshot());
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
			{ timer: timeout_timer, escalation_timers: [escalation_timer], failure_messages: [] },
			() => undefined,
		);

		const output = new ReviewAgentOutputBuffer();
		state.complete(0, output.snapshot());
		jest.advanceTimersByTime(1_000);

		expect(descendants_killed).toBe(false);
	});
});
