import { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";
import { FakeReviewAgentProcess } from "tests/bridge/ts/core/review-agent/fake_review_agent_process";

describe("review agent process lifecycle", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	test("reports a failed completion after timeout escalation", async () => {
		jest.useFakeTimers();
		const child = new ChildProcess();
		Object.defineProperty(child, "pid", { value: 4242 });
		const review_process = new FakeReviewAgentProcess(child);
		const completion = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		jest.advanceTimersByTime(10 * 60 * 1000);
		child.emit("close", null);
		jest.advanceTimersByTime(1_000);
		const result = await completion;
		expect(result.exit_code).toBe(1);
	});

	test("rejects a child that exits successfully after timeout", async () => {
		jest.useFakeTimers();
		const child = new ChildProcess();
		const review_process = new FakeReviewAgentProcess(child);
		const kill = jest.spyOn(child, "kill").mockImplementation(() => true);
		const completion = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		jest.advanceTimersByTime(10 * 60 * 1000);
		child.emit("close", 0);
		jest.advanceTimersByTime(1_000);
		const result = await completion;
		const signals = kill.mock.calls.map((call) => call[0]);

		expect({ exit_code: result.exit_code, timeout_message: result.stderr, signals }).toEqual({
			exit_code: 1,
			timeout_message: expect.stringContaining("timed out"),
			signals: ["SIGTERM", "SIGKILL"],
		});
	});

	test("accepts a child that exits successfully before timeout", async () => {
		const child = new ChildProcess();
		const review_process = new FakeReviewAgentProcess(child);
		const completion = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		child.emit("close", 0);
		const result = await completion;

		expect(result).toEqual({ exit_code: 0, stdout: "", stderr: "" });
	});

	test("sends termination signals through the production lifecycle", () => {
		jest.useFakeTimers();
		const child = Object.defineProperty(new ChildProcess(), "pid", { value: 4242 });
		const review_process = new FakeReviewAgentProcess(child);
		const kill_process = jest.spyOn(globalThis.process, "kill").mockImplementation(() => true);
		const kill_child = jest.spyOn(child, "kill").mockImplementation(() => true);
		ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		jest.advanceTimersByTime(10 * 60 * 1000);
		child.emit("close", null);
		jest.advanceTimersByTime(1_000);
		const signals = [
			...kill_process.mock.calls.map((call) => call[1]),
			...kill_child.mock.calls.map((call) => call[0]),
		];
		expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
	});

	test("configures detached process groups on supported systems", async () => {
		const child = new ChildProcess();
		const review_process = new FakeReviewAgentProcess(child);
		const completion = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		child.emit("close", 0);
		await completion;
		const options = review_process.spawn_options();
		let detached = false;
		for (const option of options) {
			detached = option.detached === true;
		}
		expect(detached).toBe(globalThis.process.platform !== "win32");
	});
});
