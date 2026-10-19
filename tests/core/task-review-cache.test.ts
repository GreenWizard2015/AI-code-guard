import { join } from "node:path";
import { describe, expect, jest, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { TaskReporting } from "src/core/support/task_reporting";
import { CliApplication } from "src/core/cli_application";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";
import { TaskReviewCacheScenario } from "tests/bridge/ts/core/task-review-cache-scenario";

describe("coding-lint cache and review reporting", () => {
	const fixture_factory = new TaskReviewMemoryFixture();

	test("preserves blocking diagnostics on a warm complete-cache CLI run", async () => {
		const fixture = fixture_factory.create("type Value = string;\n");
		const cli = new CliApplication(fixture.io, fixture.source_io);
		const scenario = new TaskReviewCacheScenario();
		const result = await scenario.warm_cli_cache(cli, fixture);
		expect(result).toEqual({
			cold_exit_is_failure: true,
			warm_exit_is_failure: true,
			same_report: true,
			cache_exists: true,
		});
	});

	test("sets a failing process status for a pending review without an agent", async () => {
		const previous_exit_code = process.exitCode;
		process.exitCode = 0;
		const fixture = fixture_factory.create("const value = 1;\n");
		fixture.io.directory_operations.create_directory(join(fixture.root, ".ai-code-guard", "review"));
		fixture.io.file_content.write_text(
			join(fixture.root, ".ai-code-guard", "review", "pending.md"),
			"confirmed pending review\n",
		);
		const cli = new CliApplication(fixture.io, fixture.source_io);
		let exit_code = 0;
		try {
			await cli.run_project(fixture.cli_options(false, false, "none"), fixture.stage_timer());
			if (process.exitCode !== undefined) {
				exit_code = Number(process.exitCode);
			}
		} finally {
			process.exitCode = previous_exit_code;
		}
		expect(exit_code).toBe(1);
	});

	test("runs a forced review at the CLI boundary when lint diagnostics exist", async () => {
		const previous_exit_code = process.exitCode;
		process.exitCode = 0;
		const fixture = fixture_factory.create("const value: string = 1;\n");
		const run_review_agent = jest
			.spyOn(TaskReporting.prototype, "run_review_agent")
			.mockResolvedValue({ provider: "codex", message: "review recorded" });
		let review_request: { provider: string; force_review: boolean } | undefined;
		const cli = new CliApplication(fixture.io, fixture.source_io);
		try {
			await cli.run_project(fixture.cli_options(true, true, "codex"), fixture.stage_timer());
			const call = run_review_agent.mock.lastCall;
			if (call !== undefined) {
				review_request = { provider: call[0], force_review: call[1].force_review };
			}
		} finally {
			run_review_agent.mockRestore();
			process.exitCode = previous_exit_code;
		}
		expect(review_request).toEqual({ provider: "codex", force_review: true });
	});

	test("preserves a global unused-class diagnostic on a warm analysis-cache consumer", () => {
		const fixture = fixture_factory.create("export class UnusedClass {}\n");
		const configuration = new LintRunConfiguration(fixture.source_io, fixture.io);
		const scenario = new TaskReviewCacheScenario();
		const results = scenario.warm_unused_class_diagnostics(configuration, fixture);
		expect({
			first_count: results.first.length,
			same_count: results.first.length === results.second.length,
			same_diagnostics: results.first.every((diagnostic, index) => diagnostic === results.second[index]),
			second_count: results.second.length,
		}).toEqual({ first_count: 1, same_count: true, same_diagnostics: true, second_count: 1 });
	});

	test("invalidates global diagnostics after a source edit", () => {
		const fixture = fixture_factory.create("export class UnusedClass {}\n");
		const configuration = new LintRunConfiguration(fixture.source_io, fixture.io);
		const scenario = new TaskReviewCacheScenario();
		const counts = scenario.invalidated_unused_class_diagnostics(configuration, fixture);
		expect(counts).toEqual({ initial: 1, changed: 0 });
	});
});
