import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { CliApplication } from "src/core/cli_application";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { LintStageTimer } from "src/lint_stage_timer";
import { ViolationValue } from "src/model/violation_value";
import type { TaskReportingContract } from "src/task_protocols";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { TaskReviewFailingSourceIO } from "tests/bridge/ts/core/task-review-failing-source-io";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";

describe("coding-lint process status reporting", () => {
	const fixture_factory = new TaskReviewMemoryFixture();

	test("returns a failing status for a blocking lint report", async () => {
		const fixture = fixture_factory.create("type Value = string;\n", "functions.ts");
		const cli = new CliApplication(fixture._io, fixture._source_io);
		const status = await cli.run_cli(["node", "cli.ts", "--root", fixture._root]);

		expect(status).toEqual({ lint_failed: true, review_failed: false });
	});

	test("does not start a forced review without a selected agent", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review = new CliArchitectureReview(reporting, new LintStageTimer());
		const command_line_options = new CommandLineOptions(["node", "cli.ts", "--force-review"]);
		const options = command_line_options.value();
		const status = await review.status(options, []);

		expect(status).toEqual({ required: false, active: false, completed: false, failed: false });
	});

	test("uses review state after the injected agent run", async () => {
		let completed = false;
		const requests: { provider: string; forced: boolean }[] = [];
		const reporting: TaskReportingContract = {
			format: () => "",
			review_status: () => ({ required: false, active: false, completed, failed: false }),
			run_review_agent: (provider, options) => {
				requests.push({ provider, forced: options.force_review });
				completed = true;
				return Promise.resolve({ provider, message: "review completed" });
			},
		};
		const review = new CliArchitectureReview(reporting, new LintStageTimer());
		const command_line = new CommandLineOptions(["node", "cli.ts", "--force-review", "--review-agent", "codex"]);
		const options = command_line.value();
		const status = await review.status(options, []);

		expect({ status, must_fail: review.must_fail(status), requests }).toEqual({
			status: { required: true, active: false, completed: true, failed: false },
			must_fail: false,
			requests: [{ provider: "codex", forced: true }],
		});
	});

	test("requests review for clean code when architecture findings remain", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		fixture._file_io.file(fixture.task_path("review/open.md")).write_text("confirmed finding\n");
		const command_line_options = new CommandLineOptions(["node", "cli.ts", "--review-agent", "codex"]);
		const options = command_line_options.value();
		const review = new CliArchitectureReview(reporting, new LintStageTimer());
		const status = await review.status(options, []);

		expect(status).toEqual({ required: true, active: true, completed: false, failed: true });
	});

	test("does not request review while code diagnostics remain", async () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "source.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const command_line_options = new CommandLineOptions(["node", "cli.ts", "--review-agent", "codex"]);
		const options = command_line_options.value();
		const review = new CliArchitectureReview(reporting, new LintStageTimer());
		const status = await review.status(options, [
			new ViolationValue({
				file: "source.ts",
				line: 1,
				message: "problem",
				hint: "fix",
				rule_id: "example",
				priority: 1,
			}),
		]);

		expect(status).toEqual({ required: false, active: false, completed: false, failed: false });
	});

	test("preserves the project error from in-memory source discovery", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		const project_error = new Error("project source failure");
		const cli = new CliApplication(fixture._io, new TaskReviewFailingSourceIO(project_error));
		const result = await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer()).then(
			() => undefined,
			(error) => error,
		);

		expect(result).toBe(project_error);
	});
});
