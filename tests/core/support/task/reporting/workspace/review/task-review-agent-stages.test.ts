import { describe, expect, test } from "@jest/globals";
import { REVIEW_STAGES } from "src/constants";
import "src/core/lint_project_context_creator";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import { StubReviewHooks } from "tests/bridge/ts/core/review-agent/stub-review-hooks";
import { StubTaskReviewRunner } from "tests/bridge/ts/core/stub_task_review_runner";
import { COMPLETED_REVIEW_RESULT } from "tests/core/constants";
import { TaskReviewAgentStageFixture } from "tests/core/support/task/reporting/workspace/review/task-review-agent-stage-fixture";

describe("task review agent stage selection", () => {
	test("runs every review stage concurrently and writes completion", async () => {
		const fixture = new TaskReviewAgentStageFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		const task_review = new TaskReview(root, _io);
		const runner_snapshot = runner.initial_review_snapshot();
		expect({
			completed: task_review.completed(),
			prefixes: [...new Set(runner_snapshot.prefixes)],
		}).toEqual({
			completed: true,
			prefixes: REVIEW_STAGES.map((stage) => stage.prefix),
		});
	});

	test("does not certify completion after a selected stage only", async () => {
		const fixture = new TaskReviewAgentStageFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const result = await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: ["boundaries"],
		});
		const task_review = new TaskReview(root, _io);
		expect({
			provider: result.provider,
			prefixes: runner.initial_review_snapshot().prefixes,
			completed: task_review.completed(),
		}).toEqual({ provider: "codex", prefixes: ["review-boundaries-"], completed: false });
	});

	test("runs exactly the selected stages in a multi-stage review", async () => {
		const fixture = new TaskReviewAgentStageFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		const result = await review.run_parallel("codex", {
			review_cleanup: false,
			force_review: false,
			review_stages: ["boundaries", "tests"],
		});
		expect({ provider: result.provider, prefixes: runner.initial_review_snapshot().prefixes }).toEqual({
			provider: "codex",
			prefixes: ["review-boundaries-", "review-tests-"],
		});
	});

	test("runs one initial dialogue per parallel stage when findings are created", async () => {
		const fixture = new TaskReviewAgentStageFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const finding = `${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`;
		const runner = new StubTaskReviewRunner({ ...COMPLETED_REVIEW_RESULT, no_issues: false }, finding, false, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		expect(runner.initial_review_snapshot().run_count).toBe(REVIEW_STAGES.length);
	});

	test("does not rerun a stage when its initial dialogue records no findings", async () => {
		const fixture = new TaskReviewAgentStageFixture();
		fixture.initialize();
		const { root, _io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, _io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: _io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		expect(runner.initial_review_snapshot().run_count).toBe(REVIEW_STAGES.length);
	});
});
