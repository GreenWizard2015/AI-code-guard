import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import {
	REVIEW_CLEANUP_COMMON_DOCUMENT,
	REVIEW_COMMON_DOCUMENT,
	REVIEW_DOCUMENT_NAMES,
	REVIEW_FINDING_DOCUMENT,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_DOCUMENT,
	REVIEW_PREAMBLE_PLACEHOLDER,
} from "src/core/support/task/constants";
import { ON_REVIEW_DOCUMENT, REVIEW_FAILURE_FILE } from "src/core/support/task/review-agent/constants";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { ReviewAgentHooks } from "src/core/support/task/review-agent/review_agent_hooks";
import { TaskReview } from "src/core/support/task/task_review";
import { TaskReviewAgent } from "src/core/support/task/task_review_agent";
import { REPORTING_PROJECT_ROOT, REVIEW_STAGES } from "src/constants";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { RecordingProcess } from "tests/bridge/ts/core/recording-review-process";
import { StubReviewHooks } from "tests/bridge/ts/core/review-agent/stub-review-hooks";
import { StubTaskReviewRunner } from "tests/bridge/ts/core/stub_task_review_runner";
import { COMPLETED_REVIEW_RESULT } from "tests/core/constants";
import { TaskReviewAgentWorkspace } from "tests/bridge/ts/core/support/task/task-review-agent-workspace";

/** Responsibilities: _review test workspace_, _agent prompt data_. **/
class TaskReviewAgentFixture {
	/** Responsibilities: _review test workspace construction_. **/
	public create(): TaskReviewAgentWorkspace {
		const root = "/virtual/task-review-agent";
		const prompt = `# Architecture review agent instructions\n${REVIEW_PATH_PLACEHOLDER}\n${REVIEW_PREAMBLE_PLACEHOLDER}\n`;
		const files = new Map<string, string>([[join(root, "source.ts"), "export const initial = true;\n"]]);
		for (const file of REVIEW_DOCUMENT_NAMES) {
			files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", file), prompt);
		}
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT), "Review preamble.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_COMMON_DOCUMENT), "Allowed operations.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_CLEANUP_COMMON_DOCUMENT), "Cleanup operations.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_FINDING_DOCUMENT), "Finding requirements.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", ON_REVIEW_DOCUMENT), "Defects remaining to find: {N}.\n");
		const file_io = new InMemoryFileIO();
		file_io.seed_files(files);
		return new TaskReviewAgentWorkspace(root, file_io);
	}
}

describe("task review agent", () => {
	const fixture_factory = new TaskReviewAgentFixture();
	test("runs every review stage concurrently and writes completion", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		const task_review = new TaskReview(root, io);
		expect({
			completed: task_review.completed(),
			prefixes: [...new Set(runner.initial_prefixes)],
		}).toEqual({
			completed: true,
			prefixes: REVIEW_STAGES.map((stage) => stage.prefix),
		});
	});

	test("does not certify completion after a selected stage only", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: ["boundaries"],
		});

		const task_review = new TaskReview(root, io);
		expect(task_review.completed()).toBe(false);
	});

	test("runs one initial dialogue per parallel stage when findings are created", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const finding = `${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`;
		const runner = new StubTaskReviewRunner({ ...COMPLETED_REVIEW_RESULT, no_issues: false }, finding, false, io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		expect(runner.initial_run_count).toBe(REVIEW_STAGES.length);
	});

	test("keeps confirmed findings open", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(
			{ ...COMPLETED_REVIEW_RESULT, no_issues: false },
			"# Finding\n\nConfirmed.\n",
			false,
			io,
		);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		const files = new ReviewAgentFiles(join(root, ".ai-code-guard", "review"), io, "review-boundaries-");
		const task_review = new TaskReview(root, io);
		expect({ completed: task_review.completed(), findings: files.review_notes().length }).toEqual({
			completed: false,
			findings: 1,
		});
	});

	test("does not certify a source changed during review", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", true, io);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const execution = await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		expect({
			provider: execution.provider,
			failure: io.file_content.file_text(join(root, ".ai-code-guard", "review", REVIEW_FAILURE_FILE)),
		}).toEqual({
			provider: "none",
			failure: expect.stringContaining("Project source changed during architecture review"),
		});
	});

	test("does not certify a review rejected by the stop hook", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, io);
		const hooks = new StubReviewHooks();
		hooks.stop_fails = true;
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks,
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const execution = await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		const task_review = new TaskReview(root, io);
		expect({ execution, completed: task_review.completed() }).toEqual({
			execution: { provider: "none", message: "stop hook failed" },
			completed: false,
		});
	});

	test("does not certify a review when the production hook returns a denial", async () => {
		const fixture = fixture_factory.create();
		const { root, io } = fixture;
		const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, io);
		const process = new RecordingProcess();
		process.hook_result = {
			exit_code: 0,
			stdout: JSON.stringify({ allowed: false, reason: "review is incomplete" }),
			stderr: "",
		};
		const hooks = new ReviewAgentHooks(root, "/tools/tsx", "/tools/agent-hooks.ts", process);
		const review = new TaskReviewAgent({
			root,
			agent_catalog: runner,
			hooks,
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const execution = await review.run_parallel("codex", {
			review_cleanup: true,
			force_review: false,
			review_stages: [],
		});
		expect({
			provider: execution.provider,
			message: execution.message,
			failure: io.file_content.file_text(join(root, ".ai-code-guard", "review", REVIEW_FAILURE_FILE)),
		}).toEqual({
			provider: "none",
			message: "Error: review is incomplete",
			failure: expect.stringContaining("review is incomplete"),
		});
	});

	test.each(REVIEW_STAGES.map((stage) => stage.id))(
		"does not certify a review when the %s stage stop hook is rejected",
		async (stage) => {
			const fixture = fixture_factory.create();
			const { root, io } = fixture;
			const runner = new StubTaskReviewRunner(COMPLETED_REVIEW_RESULT, "", false, io);
			const hooks = new StubReviewHooks();
			hooks.stop_failure_stage = stage;
			const review = new TaskReviewAgent({
				root,
				agent_catalog: runner,
				hooks,
				hook_command: "/tools/tsx",
				hook_file: "/tools/agent-hooks.ts",
				file_io: io,
			});
			const execution = await review.run_parallel("codex", {
				review_cleanup: true,
				force_review: false,
				review_stages: [],
			});
			const task_review = new TaskReview(root, io);
			expect({ provider: execution.provider, completed: task_review.completed() }).toEqual({
				provider: "none",
				completed: false,
			});
		},
	);
});
