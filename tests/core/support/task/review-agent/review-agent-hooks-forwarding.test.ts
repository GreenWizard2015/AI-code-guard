import { describe, expect, test } from "@jest/globals";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";

describe("review agent hook forwarding", () => {
	test("forwards the review prefix to the hook process", () => {
		const review_process = new RecordingProcess();
		const review_hooks = new ReviewAgentHooks("/project", "/tools/tsx", "/project/hook.ts", review_process);
		review_hooks.run({
			context: {
				event: "PreToolUse",
				provider: "codex",
				root: "/project",
				review_root: "/project/.ai-code-guard/review",
				hook_file: "agent-hooks.ts",
				review_stage: "boundaries",
				review_prefix: "review-boundaries-",
				review_phase: "initial",
				review_start_ms: 0,
			},
			tool: { name: "Read", input: "{}" },
			result: { exit_code: 0, stdout: "", stderr: "" },
		});

		expect(review_process.hook_snapshot().review_prefix).toBe("review-boundaries-");
	});

	test("passes the configured hook executable and file", () => {
		const review_process = new RecordingProcess();
		const review_hooks = new ReviewAgentHooks("/project", "/tools/tsx", "/project/hook.ts", review_process);
		review_hooks.run({
			context: {
				event: "PreToolUse",
				provider: "codex",
				root: "/project",
				review_root: "/project/.ai-code-guard/review",
				hook_file: "agent-hooks.ts",
				review_stage: "tests",
				review_prefix: "review-tests-",
				review_phase: "initial",
				review_start_ms: 0,
			},
			tool: { name: "Read", input: "{}" },
			result: { exit_code: 0, stdout: "", stderr: "" },
		});

		expect({ command: review_process.hook_snapshot().command, file: review_process.hook_snapshot().file }).toEqual({
			command: "/tools/tsx",
			file: "/project/hook.ts",
		});
	});
});
