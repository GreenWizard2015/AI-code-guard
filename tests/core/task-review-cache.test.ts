import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { CliApplication } from "src/core/cli_application";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { TaskReviewCacheScenario } from "tests/bridge/ts/core/task-review-cache-scenario";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";

describe("coding-lint cache and review reporting", () => {
	const fixture_factory = new TaskReviewMemoryFixture();

	test("preserves blocking diagnostics on a warm complete-cache CLI run", async () => {
		const fixture = fixture_factory.create("type Value = string;\n");
		const cli = new CliApplication(fixture._io, fixture._source_io);
		const scenario = new TaskReviewCacheScenario();
		const result = await scenario.warm_cli_cache(cli, fixture);
		expect(result).toEqual({
			cold_exit_is_failure: true,
			warm_exit_is_failure: true,
			same_report: true,
			cache_exists: true,
		});
	});

	test("returns a failing status for a pending review without an agent", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		fixture._io.create_directory(join(fixture._root, ".ai-code-guard", "review"));
		fixture._io
			.file(join(fixture._root, ".ai-code-guard", "review", "pending.md"))
			.write_text("confirmed pending review\n");
		const cli = new CliApplication(fixture._io, fixture._source_io);
		const status = await cli.run_project(fixture.cli_options(false, false, "none"), fixture.stage_timer());
		expect(status).toEqual({ lint_failed: true, review_failed: true });
	});

	test("preserves a global unused-class diagnostic on a warm analysis-cache consumer", () => {
		const fixture = fixture_factory.create("export class UnusedClass {}\n");
		const configuration = new LintRunConfiguration(fixture._source_io, fixture._io);
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
		const configuration = new LintRunConfiguration(fixture._source_io, fixture._io);
		const scenario = new TaskReviewCacheScenario();
		const counts = scenario.invalidated_unused_class_diagnostics(configuration, fixture);
		expect(counts).toEqual({ initial: 1, changed: 0 });
	});
});
