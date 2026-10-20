import "src/core/lint_project_context_creator";
import { PassThrough } from "node:stream";
import { ChildProcess } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import { expect, test } from "@jest/globals";
import { ReviewAgentProcess } from "src/core/support/task/review_agent_process";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";
import { CleanupFailureReviewAgentProcess } from "tests/bridge/ts/core/review-agent/cleanup-failure-review-agent-process";

/** Responsibilities: _streaming provider simulation_, _review termination handling_. **/
class ReviewAgentProcessTestDriver extends ReviewAgentProcess {
	private readonly child: ChildProcess;
	public readonly probe_options: SpawnSyncOptionsWithStringEncoding[];
	private readonly probe_result: SpawnSyncReturns<string>;

	/** Responsibilities: _test process creation_. **/
	protected override create_agent(_command: string, _arguments_list: readonly string[], _root: string): ChildProcess {
		return this.child;
	}

	/** Responsibilities: _test process termination_. **/
	protected override terminate_agent(_child: ChildProcess, _signal: NodeJS.Signals): void {}

	/** Responsibilities: _mocked synchronous subprocess boundary_. **/
	protected override spawn_sync(
		_command: string,
		_arguments_list: readonly string[],
		options: SpawnSyncOptionsWithStringEncoding,
	): SpawnSyncReturns<string> {
		this.probe_options.push(options);
		return this.probe_result;
	}

	/** Responsibilities: _process harness initialization_. **/
	public constructor(child: ChildProcess, probe_result: SpawnSyncReturns<string>) {
		super();
		this.child = child;
		this.probe_options = [];
		this.probe_result = probe_result;
	}
}

describe("review agent hook forwarding", () => {
	test("bounds provider availability probes", () => {
		const review_process = new ReviewAgentProcessTestDriver(new ChildProcess(), {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: null,
			signal: "SIGTERM",
			error: new Error("provider version probe timed out"),
		});
		const available = ReviewAgentProcess.prototype.available.call(review_process, "codex");
		const timeout = review_process.probe_options[0]?.timeout;

		expect(available).toBe(false);
		expect(timeout !== undefined && Number.isFinite(timeout) && timeout > 0).toBe(true);
	});

	test("passes the review prefix to the mocked hook process", () => {
		const review_process = new RecordingProcess();
		const review_hooks = new ReviewAgentHooks("/project", "/tools/tsx", "/project/hook.ts", review_process);
		review_hooks.run({
			event: "PreToolUse",
			provider: "codex",
			root: "/project",
			review_root: "/project/.ai-code-guard/review",
			hook_file: "agent-hooks.ts",
			review_stage: "boundaries",
			review_prefix: "review-boundaries-",
			review_phase: "initial",
			tool_name: "Read",
			tool_input: "{}",
			exit_code: 0,
			stdout: "",
			stderr: "",
		});

		expect(review_process.hook_event.review_prefix).toBe("review-boundaries-");
	});

	test("passes the configured hook command and file to the mock", () => {
		const review_process = new RecordingProcess();
		const review_hooks = new ReviewAgentHooks("/project", "/tools/tsx", "/project/hook.ts", review_process);
		review_hooks.run({
			event: "PreToolUse",
			provider: "codex",
			root: "/project",
			review_root: "/project/.ai-code-guard/review",
			hook_file: "agent-hooks.ts",
			review_stage: "tests",
			review_prefix: "review-tests-",
			review_phase: "initial",
			tool_name: "Read",
			tool_input: "{}",
			exit_code: 0,
			stdout: "",
			stderr: "",
		});

		expect({ command: review_process.hook_command, file: review_process.hook_file }).toEqual({
			command: "/tools/tsx",
			file: "/project/hook.ts",
		});
	});

	test("settles with a failure when registry cleanup throws", async () => {
		const child = new ChildProcess();
		const review_process = new CleanupFailureReviewAgentProcess(child);
		const result = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");

		child.emit("close", 0);

		await expect(result).resolves.toEqual({
			exit_code: 1,
			stdout: "",
			stderr: expect.stringContaining("simulated registry cleanup failure"),
		});
	});

	test("bounds retained provider output while preserving diagnostic tails", async () => {
		const child = new ChildProcess();
		const stdout = new PassThrough();
		const stderr = new PassThrough();
		Object.defineProperty(child, "stdout", { value: stdout });
		Object.defineProperty(child, "stderr", { value: stderr });
		const review_process = new ReviewAgentProcessTestDriver(child, {
			pid: 0,
			output: [],
			stdout: "",
			stderr: "",
			status: 0,
			signal: null,
		});
		const result = ReviewAgentProcess.prototype.run_async.call(review_process, "review-agent", [], "/project");
		stdout.emit("data", `${"x".repeat(2_000_000)}tail`);
		stderr.emit("data", `${"y".repeat(2_000_000)}error-tail`);
		child.emit("close", 0);

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
