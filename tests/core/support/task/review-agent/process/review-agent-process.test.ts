import "src/core/lint_project_context_creator";
import { constants } from "node:os";
import { PassThrough, Readable } from "node:stream";
import { expect, test } from "@jest/globals";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { ReviewAgentProcess } from "src/core/support/task/review-agent/process/review_agent_process";
import { ReviewAgentProcessLifecycle } from "src/core/support/task/review-agent/process/review_agent_process_lifecycle";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import type { ReviewAgentProcessResult } from "src/task_review_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewAgentChildProcess } from "tests/bridge/ts/core/review-agent/review-agent-child-process";
import { ReviewAgentProcessLifecycleFixture } from "tests/bridge/ts/core/review-agent/review-agent-process-lifecycle-fixture";
import { ReviewAgentProcessTestDriver } from "tests/bridge/ts/core/review-agent/review-agent-process-test-driver";
import { ProcessSignalProbe } from "tests/bridge/ts/core/support/process_signal_probe";

describe("review agent hook forwarding", () => {
	test("probes liveness through the injected Node process", () => {
		const probe = new ProcessSignalProbe(false);
		const injected_signal = new NodeProcessSignal(probe, new InMemoryFileIO(), process.platform);
		const exists = injected_signal.pid_exists({ value: 42 });

		expect({ exists, signals: probe.observations() }).toEqual({
			exists: true,
			signals: [{ pid: 42, signal: 0 }],
		});
	});

	test("reports a permission-denied process-group termination as unsuccessful", () => {
		const probe = new ProcessSignalProbe(true);
		const signal = new NodeProcessSignal(probe, new InMemoryFileIO(), process.platform);
		const result = signal.terminate_group({ id: 4321 });

		expect({ result, signals: probe.observations() }).toEqual({
			result: false,
			signals: [{ pid: -4321, signal: constants.signals.SIGTERM }],
		});
	});

	test("bounds provider availability probes", () => {
		const review_process = new ReviewAgentProcessTestDriver(
			new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([])),
			{
				pid: 0,
				output: [],
				stdout: "",
				stderr: "",
				status: null,
				signal: "SIGTERM",
				error: new Error("provider version probe timed out"),
			},
		);
		const file_io = new InMemoryFileIO();
		const signal = new NodeProcessSignal(process, file_io, process.platform);
		const review_agent_process = new ReviewAgentProcess(file_io, review_process, process.platform, signal);
		const available = review_agent_process.available("codex");
		const probe = review_process.probe_snapshot(0);

		expect(available).toBe(false);
		expect({
			timeout: Number.isFinite(probe.timeout) && probe.timeout > 0,
			cwd: probe.cwd,
			input: probe.input,
		}).toEqual({
			timeout: true,
			cwd: process.cwd(),
			input: "",
		});
	});

	test("builds hook arguments and input from one hook process request", () => {
		const review_process = new ReviewAgentProcessTestDriver(
			new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([])),
			{
				pid: 0,
				output: [],
				stdout: '{"allowed":true,"reason":""}',
				stderr: "",
				status: 0,
				signal: null,
			},
		);
		const file_io = new InMemoryFileIO();
		const signal = new NodeProcessSignal(process, file_io, process.platform);
		const review_agent_process = new ReviewAgentProcess(file_io, review_process, process.platform, signal);
		const hooks = new ReviewAgentHooks("/project", "/tools/tsx", "/project/hook.ts", review_agent_process);
		hooks.run({
			context: {
				event: "PreToolUse",
				provider: "codex",
				root: "/project",
				review_root: "/project/.ai-code-guard/review",
				hook_file: "agent-hooks.ts",
				review_stage: "tests",
				review_prefix: "review-tests-",
				review_start_ms: 0,
			},
			tool: { name: "Read", input: "{}" },
			result: { exit_code: 0, stdout: "", stderr: "" },
		});
		const probe = review_process.probe_snapshot(0);
		const arguments_list = probe.arguments_list;

		expect({ cwd: probe.cwd, input: probe.input }).toEqual({
			cwd: "/project",
			input: expect.stringContaining('"review_prefix":"review-tests-"'),
		});
		expect(arguments_list).toEqual(["/project/hook.ts", "--review-prefix", "review-tests-"]);
	});

	test("reports a cleanup failure from the registry", () => {
		const child = new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([]));
		const lifecycle = new ReviewAgentProcessLifecycleFixture("", "simulated registry cleanup failure");
		const process_lifecycle = new ReviewAgentProcessLifecycle(lifecycle.context());
		let result: ReviewAgentProcessResult = { exit_code: 0, stdout: "", stderr: "" };
		process_lifecycle.attach({ root: "/project", child, ownership_token: "token" }, (completed) => {
			result = completed;
		});

		child.emit("close", { received: true, code: 0 });

		expect(result).toEqual({
			exit_code: 1,
			stdout: "",
			stderr: expect.stringContaining("simulated registry cleanup failure"),
		});
	});

	test("waits for a child to close after identity registration fails", () => {
		const child = new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([]));
		const lifecycle = new ReviewAgentProcessLifecycleFixture("identity write denied");
		let settled = false;
		const process_lifecycle = new ReviewAgentProcessLifecycle(lifecycle.context());
		process_lifecycle.attach({ root: "/project", child, ownership_token: "token" }, () => {
			settled = true;
		});
		const settled_before_reap = settled;
		child.emit("close", { received: true, code: 0 });

		expect({ settled_before_reap, signals: lifecycle.termination_signals() }).toEqual({
			settled_before_reap: false,
			signals: ["SIGKILL"],
		});
	});

	test("returns registration failure after terminating the child", () => {
		const child = new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([]));
		const lifecycle = new ReviewAgentProcessLifecycleFixture("identity write denied");
		const process_lifecycle = new ReviewAgentProcessLifecycle(lifecycle.context());
		let outcome: ReviewAgentProcessResult = { exit_code: 0, stdout: "", stderr: "" };
		process_lifecycle.attach({ root: "/project", child, ownership_token: "token" }, (result) => {
			outcome = result;
		});
		child.emit("close", { received: true, code: 0 });

		expect({ exit_code: outcome.exit_code, stderr: outcome.stderr, signals: lifecycle.termination_signals() }).toEqual({
			exit_code: 1,
			stderr: expect.stringContaining("identity write denied"),
			signals: ["SIGKILL"],
		});
	});

	test("owns a child error after identity registration fails", () => {
		const child = new ReviewAgentChildProcess(4242, Readable.from([]), Readable.from([]));
		const lifecycle = new ReviewAgentProcessLifecycleFixture("identity write denied");
		const process_lifecycle = new ReviewAgentProcessLifecycle(lifecycle.context());
		let outcome: ReviewAgentProcessResult = { exit_code: 0, stdout: "", stderr: "" };
		process_lifecycle.attach({ root: "/project", child, ownership_token: "token" }, (result) => {
			outcome = result;
		});
		const error = new Error("simulated spawn failure");
		const error_emitted = child.emit("error", error);
		child.emit("close", { received: false, code: 1 });

		expect({ error_emitted, outcome }).toEqual({
			error_emitted: true,
			outcome: {
				exit_code: 1,
				stdout: "",
				stderr: expect.stringContaining("simulated spawn failure"),
			},
		});
	});

	test("bounds retained provider output while preserving diagnostic tails", async () => {
		const stdout = new PassThrough();
		const stderr = new PassThrough();
		const child = new ReviewAgentChildProcess(4323, stdout, stderr);
		const review_process = new ReviewAgentProcessTestDriver(child, {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: 0,
			signal: null,
		});
		const file_io = new InMemoryFileIO();
		const signal = new NodeProcessSignal(process, file_io, process.platform);
		const review_agent_process = new ReviewAgentProcess(file_io, review_process, process.platform, signal);
		const result = review_agent_process.run_async({
			command: "review-agent",
			arguments_list: [],
			root: "/project",
		});
		stdout.emit("data", `${"x".repeat(2_000_000)}tail`);
		stderr.emit("data", `${"y".repeat(2_000_000)}error-tail`);
		child.emit("close", { received: true, code: 0 });

		const completed = await result;
		expect({
			exit_code: completed.exit_code,
			stdout_tail: completed.stdout.endsWith("tail"),
			stderr_tail: completed.stderr.includes("error-tail"),
			stdout_size: completed.stdout.length === 8192,
			stderr_size: completed.stderr.length === 8192,
		}).toEqual({
			exit_code: 0,
			stdout_tail: true,
			stderr_tail: true,
			stdout_size: true,
			stderr_size: true,
		});
	});
});
