import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { REVIEW_STAGES } from "src/constants";
import "src/core/lint_project_context_creator";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import { REVIEW_FAILURE_FILE } from "src/core/support/task/review-agent/constants";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";
import { StubReviewHooks } from "tests/bridge/ts/core/review-agent/stub-review-hooks";
import { StubTaskReviewRunner } from "tests/bridge/ts/core/stub_task_review_runner";
import { COMPLETED_REVIEW_RESULT } from "tests/core/constants";
import { TaskReviewAgentFixture } from "tests/core/support/task/reporting/workspace/review/task-review-agent-fixture";

describe("task review agent", () => {
	test("keeps confirmed findings open", async () => {
		const fixture = new TaskReviewAgentFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(
			{ ...COMPLETED_REVIEW_RESULT, no_issues: false },
			"# Finding\n\nConfirmed.\n",
			false,
			_io,
		);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		await review.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		const files = new ReviewAgentFiles(
			join(root, ".ai-code-guard", "review"),
			_io,
			"review-boundaries-",
			Number.NEGATIVE_INFINITY,
		);
		const task_review = new TaskReview(root, _io);
		expect({ completed: task_review.completed(), findings: files.review_notes().length }).toEqual({
			completed: false,
			findings: 1,
		});
	});

	test("does not certify a source changed during review", async () => {
		const fixture = new TaskReviewAgentFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", true, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const execution = await review.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		expect({
			provider: execution.provider,
			failure: _io.file(join(root, ".ai-code-guard", "review", REVIEW_FAILURE_FILE)).file_text(),
		}).toEqual({
			provider: "none",
			failure: expect.stringContaining("Project source changed during architecture review"),
		});
	});

	test("does not certify a review rejected by the stop hook", async () => {
		const fixture = new TaskReviewAgentFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const hooks = new StubReviewHooks();
		hooks.reject_stop_events();
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks,
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const execution = await review.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		const task_review = new TaskReview(root, _io);
		expect({ execution, completed: task_review.completed() }).toEqual({
			execution: { provider: "none", message: "stop hook failed" },
			completed: false,
		});
	});

	test("does not certify a review when the production hook returns a denial", async () => {
		const fixture = new TaskReviewAgentFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const process = new RecordingProcess();
		process.set_hook_result({
			exit_code: 0,
			stdout: JSON.stringify({ allowed: false, reason: "review is incomplete" }),
			stderr: "",
		});
		const hooks = new ReviewAgentHooks(root, "/tools/tsx", "/tools/agent-hooks.ts", process);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks,
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const execution = await review.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		expect({
			provider: execution.provider,
			message: execution.message,
			failure: _io.file(join(root, ".ai-code-guard", "review", REVIEW_FAILURE_FILE)).file_text(),
		}).toEqual({
			provider: "none",
			message: "Error: review is incomplete",
			failure: expect.stringContaining("review is incomplete"),
		});
	});

	test("records hook process failures as an unsuccessful review", async () => {
		const fixture = new TaskReviewAgentFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const process = new RecordingProcess();
		process.set_hook_result({ exit_code: 2, stdout: "", stderr: "hook sentinel" });
		const hooks = new ReviewAgentHooks(root, "/tools/tsx", "/tools/agent-hooks.ts", process);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks,
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const result = await review.run_parallel("codex", {
			force_review: false,
			review_stages: ["boundaries"],
		});
		const failure_path = join(root, ".ai-code-guard", "review", REVIEW_FAILURE_FILE);
		const failure = _io.file(failure_path).file_text();

		expect({ provider: result.provider, message: result.message, failure }).toEqual({
			provider: "none",
			message: "Error: Review hook failed: hook sentinel",
			failure: expect.stringContaining("hook sentinel"),
		});
	});

	test.each(REVIEW_STAGES.map((stage) => stage.id))(
		"does not certify a review when the %s stage stop hook is rejected",
		async (stage) => {
			const fixture = new TaskReviewAgentFixture();
			fixture.initialize();
			const { root, _io } = fixture;
			const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
			const hooks = new StubReviewHooks();
			hooks.reject_stage_stop(stage);
			const review = new TaskReviewAgent({
				root,
				agent_catalog: runner,
				hooks,
				hook_command: "/tools/tsx",
				hook_file: "/tools/agent-hooks.ts",
				file_io: _io,
			});
			const execution = await review.run_parallel("codex", {
				force_review: false,
				review_stages: [],
			});
			const task_review = new TaskReview(root, _io);
			expect({ provider: execution.provider, completed: task_review.completed() }).toEqual({
				provider: "none",
				completed: false,
			});
		},
	);
});
