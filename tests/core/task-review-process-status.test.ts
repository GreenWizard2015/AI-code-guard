import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { CliApplication } from "src/core/cli_application";
import { CliArchitectureReview } from "src/core/support/cli_architecture_review";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { TaskReporting } from "src/core/support/task_reporting";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonAstWorker } from "src/core/python-ast-worker.mjs";
import { TaskReviewMemoryFixture } from "tests/bridge/ts/core/task-review-memory-fixture";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";

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

	test("preserves the primary project error when worker cleanup also fails", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		const cli = new CliApplication(new NodeFileIO(), new SourceText());
		const close_error = new Error("worker cleanup failure");
		const close_worker = jest.spyOn(PythonAstWorker.prototype, "close").mockReturnValue(Promise.reject(close_error));
		const result = await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer()).then(
			() => undefined,
			(error) => error,
		);
		close_worker.mockRestore();
		expect(String(result)).toContain("ENOENT");
	});

	test("propagates a cleanup error after successful project execution", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		const cli = new CliApplication(fixture.io, fixture.source_io);
		const close_error = new Error("worker cleanup failure");
		const close_worker = jest.spyOn(PythonAstWorker.prototype, "close").mockReturnValue(Promise.reject(close_error));
		const result = await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer()).then(
			() => undefined,
			(error) => error,
		);
		close_worker.mockRestore();
		expect(result).toBe(close_error);
	});

	test("closes the Python worker after direct project execution", async () => {
		const previous_exit_code = process.exitCode;
		process.exitCode = 0;
		const fixture = fixture_factory.create("const value = 1;\n");
		const cli = new CliApplication(fixture.io, fixture.source_io);
		const close_worker = jest.spyOn(PythonAstWorker.prototype, "close").mockImplementation(() => undefined);
		let close_calls = 0;
		try {
			await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer());
		} finally {
			close_calls = close_worker.mock.calls.length;
			close_worker.mockRestore();
			process.exitCode = previous_exit_code;
		}
		expect(close_calls).toBe(1);
	});

	test("closes the Python worker when direct project execution fails", async () => {
		const fixture = fixture_factory.create("const value = 1;\n");
		const cli = new CliApplication(new NodeFileIO(), new SourceText());
		const close_worker = jest.spyOn(PythonAstWorker.prototype, "close").mockImplementation(() => undefined);
		const result = await cli.run_project(fixture.cli_options(true, false, "none"), fixture.stage_timer()).then(
			() => undefined,
			(error: unknown) => error,
		);
		const close_calls = close_worker.mock.calls.length;
		close_worker.mockRestore();

		expect({ has_file_system_error: String(result).includes("ENOENT"), close_calls }).toEqual({
			has_file_system_error: true,
			close_calls: 1,
		});
	});
});
