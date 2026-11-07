import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { NodeFileIO } from "src/io/node_file_io";
import { InMemoryLintProject } from "tests/core/lint-run-configuration-project";

describe("in-memory lint run configuration", () => {
	test("excludes ignored files from selected lint targets", () => {
		const project = new InMemoryLintProject({
			"kept.ts": "export const kept = 1;\n",
			"ignored/ignored.ts": "export const ignored = 1;\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const files = configuration.input_files(project.root, ["ignored"]).files;
		configuration.close_worker_session();
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/\/kept\.ts$/u);
	});

	test("keeps ignored production files in project context", () => {
		const project = new InMemoryLintProject({
			"kept.ts": "export const kept = 1;\n",
			"ignored/ignored.ts": "export const ignored = 1;\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(
			project.options(configuration, ["ignored"]),
			LintReportMode.IN_MEMORY_PROJECT,
		);
		const files = execution.context.files().map((file) => file.absolute_path);
		configuration.close_worker_session();
		expect(files.sort()).toEqual([resolve(project.root, "ignored/ignored.ts"), resolve(project.root, "kept.ts")]);
	});

	test("classifies ignored imports as production targets for tests", () => {
		const project = new InMemoryLintProject({
			"external/service.ts": "export class Service {}\n",
			"tests/external/service.test.ts": [
				'import { Service } from "external/service";',
				"test('uses the service', () => {",
				"  const service = new Service();",
				"  expect(service).toBeInstanceOf(Service);",
				"});",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const options = project.options(configuration, ["external"]);
		const execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const external_file = resolve(project.root, "external/service.ts");
		const source = execution.context.source_record(external_file);
		const test_target_problem = execution.report.violations.some(
			(item) => item.file() === "tests/external/service.test.ts" && item.rule_id() === "test-targets",
		);
		const result = {
			selected_for_lint: options.inputs.files.includes(external_file),
			included_in_project: options.inputs.project_files.includes(external_file),
			marked_ignored: options.inputs.ignored_files.includes(external_file),
			classified_as_product: source.file_name.product(),
			resolves_as_test_target: !test_target_problem,
		};
		configuration.close_worker_session();

		expect(result).toEqual({
			selected_for_lint: false,
			included_in_project: true,
			marked_ignored: true,
			classified_as_product: true,
			resolves_as_test_target: true,
		});
	});

	test("repeats in-memory analysis with stable file diagnostics", () => {
		const project = new InMemoryLintProject({ "functions.ts": "type Value = string;\n" });
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const first = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.file() === "functions.ts");
		const second = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.file() === "functions.ts");
		configuration.close_worker_session();
		expect(
			second.map((item) => [item.file(), item.line(), item.message(), item.hint(), item.rule_id(), item.priority()]),
		).toEqual(
			first.map((item) => [item.file(), item.line(), item.message(), item.hint(), item.rule_id(), item.priority()]),
		);
		expect(second.length).toBeGreaterThan(0);
	});
});
