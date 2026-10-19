import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { afterEach, describe, expect, test } from "@jest/globals";
import { CliApplication } from "src/core/cli_application";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { TaskReporting } from "src/core/support/task_reporting";
import { LintStageTimer } from "src/lint_stage_timer";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { TaskReviewFailingSourceIO } from "tests/bridge/ts/core/task-review-failing-source-io";

describe("coding-lint process status reporting", () => {
	const fixture_factory = new TaskReviewMemoryFixture();
	const initial_exit_code = process.exitCode;

	afterEach(() => {
		process.exitCode = initial_exit_code;
	});

	test("sets a failing process status for a blocking lint report", async () => {
		const previous_exit_code = process.exitCode;
		const previous_arguments = process.argv;
		process.exitCode = 0;
		const fixture = fixture_factory.create("type Value = string;\n", "functions.ts");
		const cli = new CliApplication(fixture.io, fixture.source_io);
		let reported_exit_code: number | undefined;
		process.argv = ["node", "cli.ts", "--root", fixture.root];
		try {
			await cli.run_cli();
			reported_exit_code = process.exitCode;
		} finally {
			process.exitCode = previous_exit_code;
			process.argv = previous_arguments;
		}
		expect(reported_exit_code).toBe(1);
	});

	test("does not start a forced review without a selected agent", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review = new CliArchitectureReview(reporting, new LintStageTimer());
		const command_line_options = new CommandLineOptions();
		const options = command_line_options.from_arguments(["node", "cli.ts", "--force-review"]);
		const status = await review.status(options, []);

		expect(status).toEqual({ required: false, active: false, completed: false, failed: false });
	});

	test("preserves the project error from in-memory source discovery", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		const project_error = new Error("project source failure");
		const cli = new CliApplication(fixture.io, new TaskReviewFailingSourceIO(project_error));
		const result = await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer()).then(
			() => undefined,
			(error) => error,
		);

		expect(result).toBe(project_error);
	});
});
