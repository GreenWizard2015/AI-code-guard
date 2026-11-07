import { PassThrough } from "node:stream";
import { Readable } from "node:stream";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { ReviewAgentProcess } from "src/core/support/task/review-agent/process/review_agent_process";
import { ReviewAgentProcessLifecycle } from "src/core/support/task/review-agent/process/review_agent_process_lifecycle";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { ReviewAgentProcessResult } from "src/task_review_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { FakeReviewAgentProcess } from "tests/bridge/ts/core/review-agent/fake_review_agent_process";
import { ReviewAgentChildProcess } from "tests/bridge/ts/core/review-agent/review-agent-child-process";
import { ReviewAgentProcessLifecycleFixture } from "tests/bridge/ts/core/review-agent/review-agent-process-lifecycle-fixture";

describe("review agent process lifecycle", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	test("reports a failed completion after timeout escalation", async () => {
		jest.useFakeTimers();
		const review_process = new FakeReviewAgentProcess(
			new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([])),
		);
		const child = review_process.child_process();
		const file_io = review_process.file_io();
		const process_signal = new NodeProcessSignal(globalThis.process, file_io, globalThis.process.platform);
		const process = new ReviewAgentProcess(file_io, review_process, globalThis.process.platform, process_signal);
		const completion = process.run_async({
			command: "review-agent",
			arguments_list: [],
			root: "/project",
		});
		jest.advanceTimersByTime(10 * 60 * 1000);
		child.emit("close", { received: false, code: 1 });
		jest.advanceTimersByTime(1_000);
		const result = await completion;
		expect(result.exit_code).toBe(1);
	});

	test("rejects a child that exits successfully after timeout", async () => {
		jest.useFakeTimers();
		const lifecycle_fixture = new ReviewAgentProcessLifecycleFixture();
		const child = new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([]));
		const execution = { root: "/project", child, ownership_token: "review-token" };
		const lifecycle = new ReviewAgentProcessLifecycle(lifecycle_fixture.context());
		let result: ReviewAgentProcessResult = { exit_code: 0, stdout: "", stderr: "" };
		lifecycle.attach(execution, (completed) => {
			result = completed;
		});
		jest.advanceTimersByTime(10 * 60 * 1000);
		child.emit("close", { received: true, code: 0 });
		jest.advanceTimersByTime(1_000);

		expect({
			exit_code: result.exit_code,
			timeout_message: result.stderr,
			signals: lifecycle_fixture.termination_signals(),
		}).toEqual({
			exit_code: 1,
			timeout_message: expect.stringContaining("timed out"),
			signals: ["SIGTERM", "SIGKILL"],
		});
	});

	test("accepts a child that exits successfully before timeout", async () => {
		const review_process = new FakeReviewAgentProcess(
			new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([])),
		);
		const child = review_process.child_process();
		const file_io = review_process.file_io();
		const process_signal = new NodeProcessSignal(globalThis.process, file_io, globalThis.process.platform);
		const process = new ReviewAgentProcess(file_io, review_process, globalThis.process.platform, process_signal);
		const completion = process.run_async({
			command: "review-agent",
			arguments_list: [],
			root: "/project",
		});
		child.emit("close", { received: true, code: 0 });
		const result = await completion;

		expect(result).toEqual({ exit_code: 0, stdout: "", stderr: "" });
	});

	test("collects output from both child streams", async () => {
		const stdout = new PassThrough();
		const stderr = new PassThrough();
		const review_process = new FakeReviewAgentProcess(new ReviewAgentChildProcess(4242, stdout, stderr));
		const child = review_process.child_process();
		const file_io = review_process.file_io();
		const process_signal = new NodeProcessSignal(globalThis.process, file_io, globalThis.process.platform);
		const process = new ReviewAgentProcess(file_io, review_process, globalThis.process.platform, process_signal);
		const completion = process.run_async({
			command: "review-agent",
			arguments_list: [],
			root: "/project",
		});
		stdout.end("review output");
		stderr.end("review warning");
		child.emit("close", { received: true, code: 0 });
		const result = await completion;

		expect(result).toEqual({ exit_code: 0, stdout: "review output", stderr: "review warning" });
	});

	test("configures detached process groups on supported systems", async () => {
		const review_process = new FakeReviewAgentProcess(
			new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([])),
		);
		const child = review_process.child_process();
		const file_io = review_process.file_io();
		const process_signal = new NodeProcessSignal(globalThis.process, file_io, globalThis.process.platform);
		const process = new ReviewAgentProcess(file_io, review_process, globalThis.process.platform, process_signal);
		const completion = process.run_async({
			command: "review-agent",
			arguments_list: [],
			root: "/project",
		});
		child.emit("close", { received: true, code: 0 });
		await completion;
		const options = review_process.spawn_options();
		let detached = false;
		for (const option of options) {
			detached = option.detached === true;
		}
		expect(detached).toBe(globalThis.process.platform !== "win32");
	});

	test("uses the requested process path and rejects malformed process data", () => {
		const file_io = new InMemoryFileIO();
		const stat_fields = ["S", ...Array.from({ length: 18 }, () => "field"), "1234"];
		file_io.seed_files(
			new Map([
				["/proc/4242/stat", `4242 (review agent) ${stat_fields.join(" ")}`],
				["/proc/4243/stat", "malformed process data"],
				["/proc/sys/kernel/random/boot_id", "boot-id\n"],
			]),
		);
		const identity_factory = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io,
			ownership_token: "",
		});
		const valid_identity = identity_factory.from_process({ value: 4242 }).serialized();
		const malformed_identity = identity_factory.from_process({ value: 4243 }).serialized();
		const expected_valid_identity = process.platform === "linux" ? "4242\n1234\nboot-id\n" : "";

		expect({ valid_identity, malformed_identity }).toEqual({
			valid_identity: expected_valid_identity,
			malformed_identity: "",
		});
	});
});
