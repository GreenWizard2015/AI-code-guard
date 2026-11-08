import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { REVIEW_STAGES } from "src/constants";
import { TaskReviewAgent } from "src/core/support/task/reporting/workspace/review/task_review_agent";
import { StubReviewHooks } from "tests/bridge/ts/core/review-agent/stub-review-hooks";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { ParallelReviewRunner } from "tests/core/support/task/reporting/workspace/review/parallel-review-runner";

describe("parallel task review agent", () => {
	test("runs five concurrent provider requests with stage-specific prefixes", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "source.ts": "export const source = true;\n" });
		const { _root, _file_io: io } = fixture;
		const runner = new ParallelReviewRunner(io);
		await runner.run_review(
			() =>
				new TaskReviewAgent({
					root: _root,
					agent_catalog: runner,
					hooks: new StubReviewHooks(),
					hook_command: "/tools/tsx",
					hook_file: "/tools/agent-hooks.ts",
					file_io: io,
				}),
		);
		const result = runner.snapshot(_root);
		expect(result).toEqual({
			initial_prefixes: REVIEW_STAGES.map((stage) => stage.prefix).sort(),
			max_parallel_active: 5,
			parallel_file: false,
		});
	});

	test("force review starts when open findings already exist", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { _root, _file_io: io } = fixture;
		io.create_directory(join(_root, ".ai-code-guard", "review"));
		io.file(join(_root, ".ai-code-guard", "review", "open-finding.md")).write_text("# Open finding\n");
		const runner = new ParallelReviewRunner(io);
		const agent = new TaskReviewAgent({
			root: _root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		await agent.run_parallel("codex", { force_review: true, review_stages: [] });
		expect(runner.initial_review_count()).toBe(5);
	});

	test("starts the first review run", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { _root, _file_io: io } = fixture;
		const runner = new ParallelReviewRunner(io);
		const agent = new TaskReviewAgent({
			root: _root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const result = await agent.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		expect(result.provider).toBe("codex");
	});

	test("waits for every stage before releasing the run lock after a stage failure", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { _root, _file_io: io } = fixture;
		const runner = new ParallelReviewRunner(io);
		runner.reject_on_prefix("review-abstractions-");
		const agent = new TaskReviewAgent({
			root: _root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});

		const result = await agent.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});

		const failed_attempt = { provider: result.provider, completed: runner.completed_prefixes() };

		const retry_runner = new ParallelReviewRunner(io);
		const retry_agent = new TaskReviewAgent({
			root: _root,
			agent_catalog: retry_runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const retry = await retry_agent.run_parallel("codex", {
			force_review: true,
			review_stages: [],
		});

		const retry_attempt = { provider: retry.provider, stages: retry_runner.initial_review_count() };
		expect({ failed_attempt, retry_attempt }).toEqual({
			failed_attempt: {
				provider: "none",
				completed: [
					"review-abstractions-",
					"review-algorithms-",
					"review-boundaries-",
					"review-data-lifecycle-",
					"review-tests-",
				],
			},
			retry_attempt: { provider: "codex", stages: REVIEW_STAGES.length },
		});
	});

	test("rejects a second review run while the first run is active", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const { _root, _file_io: io } = fixture;
		const runner = new ParallelReviewRunner(io);
		const agent = new TaskReviewAgent({
			root: _root,
			agent_catalog: runner,
			hooks: new StubReviewHooks(),
			hook_command: "/tools/tsx",
			hook_file: "/tools/agent-hooks.ts",
			file_io: io,
		});
		const first_run = agent.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		const second_result = await agent.run_parallel("codex", {
			force_review: false,
			review_stages: [],
		});
		const first_result = await first_run;
		expect({ first: first_result.provider, second: second_result.provider }).toEqual({
			first: "codex",
			second: "none",
		});
	});
});
