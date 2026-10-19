import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { TestFixture } from "tests/core/test-fixture";

describe("coding lint project context timing", () => {
	const fixture = new TestFixture();

	test("reports aggregate source timing without per-file stages", () => {
		const request = fixture.fixture_lint_request({
			"tools/coding-lint/index.ts": "export const value = 1;\n",
			"tools/coding-lint/helper.py": "value = 1\n",
		});
		const options = request.options;
		const source_io = new InMemoryProjectSourceIO(options.source_texts);
		const file_io = new InMemoryFileIO();
		file_io.seed_files(options.source_texts);
		options.source_texts = new Map();
		const configuration = new LintRunConfiguration(source_io, file_io);
		configuration.lint_report(options, LintReportMode.PROJECT);
		const timing = options.stage_timer.durations();

		expect({
			has_aggregate_timing: timing.some((item) => item.name === "startup.project-context.read-files"),
			has_per_file_timing: timing.some((item) => item.name.includes("startup.project-context.read-files.file.")),
		}).toEqual({ has_aggregate_timing: true, has_per_file_timing: false });
	});

	test("reports Python bridge stage timing", () => {
		const request = fixture.fixture_lint_request({ "tools/coding-lint/helper.py": "value = 1\n" });
		const options = request.options;
		const source_io = new InMemoryProjectSourceIO(options.source_texts);
		const file_io = new InMemoryFileIO();
		file_io.seed_files(options.source_texts);
		options.source_texts = new Map();
		const configuration = new LintRunConfiguration(source_io, file_io);
		configuration.lint_report(options, LintReportMode.PROJECT);
		const timing = options.stage_timer.durations();

		expect({
			has_batch_timing: timing.some((item) => item.name.endsWith("batch-source-map")),
			has_round_trip_timing: timing.some((item) => item.name.endsWith("bridge-round-trip")),
			has_python_parse_timing: timing.some((item) => item.name.endsWith("python-ast-parse")),
			has_python_build_timing: timing.some((item) => item.name.endsWith("python-ast-build")),
			has_validation_timing: timing.some((item) => item.name.endsWith("response-validation")),
		}).toEqual({
			has_batch_timing: true,
			has_round_trip_timing: true,
			has_python_parse_timing: true,
			has_python_build_timing: true,
			has_validation_timing: true,
		});
	});

	test("keeps run-local source records and Python parse statistics", () => {
		const request = fixture.fixture_lint_request({
			"tools/coding-lint/index.ts": "export const value = 1;\n",
			"tools/coding-lint/helper.py": "value = 1\n",
		});
		const options = request.options;
		const source_io = new InMemoryProjectSourceIO(options.source_texts);
		const file_io = new InMemoryFileIO();
		file_io.seed_files(options.source_texts);
		options.source_texts = new Map();
		const configuration = new LintRunConfiguration(source_io, file_io);
		const statistics = configuration.lint_report(options, LintReportMode.PROJECT).context.statistics();

		expect(statistics).toEqual({ source_reads: 2, typescript_parses: 1, python_parses: 1, source_records: 2 });
	});

	test("formats aggregate source timing", () => {
		const request = fixture.fixture_lint_request({ "tools/coding-lint/index.ts": "export const value = 1;\n" });
		const options = request.options;
		const source_io = new InMemoryProjectSourceIO(options.source_texts);
		const file_io = new InMemoryFileIO();
		file_io.seed_files(options.source_texts);
		options.source_texts = new Map();
		const configuration = new LintRunConfiguration(source_io, file_io);
		configuration.lint_report(options, LintReportMode.PROJECT);
		options.stage_timer.add_duration("startup", 1);
		const formatted_timing = options.stage_timer.format();

		expect({
			shows_aggregate_timing: formatted_timing.includes("read-files:"),
			shows_per_file_timing: formatted_timing.includes("read-files.file."),
		}).toEqual({ shows_aggregate_timing: true, shows_per_file_timing: false });
	});
});
