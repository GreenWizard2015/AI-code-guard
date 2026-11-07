import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { NodeFileIO } from "src/io/node_file_io";
import { InMemoryLintProject } from "tests/core/lint-run-configuration-project";

describe("in-memory lint project diagnostics", () => {
	test("reports each type declaration in the root TypeScript functions file", () => {
		const project = new InMemoryLintProject({
			"functions.ts": ["type Value = string;", "interface Port {}", "enum State { Ready }", "class Owner {}"].join(
				"\n",
			),
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const files = execution.report.violations
			.filter((item) => item.rule_id() === "functions-file-type-declaration")
			.map((item) => item.file());
		configuration.close_worker_session();

		expect(files).toEqual(["functions.ts", "functions.ts", "functions.ts", "functions.ts"]);
	});

	test("collects TypeScript project directory diagnostics through the AST verifier once", () => {
		const project = new InMemoryLintProject({
			"src/service.ts": Array.from({ length: 20 }, (_, index) => `export const value_${index} = ${index};`).join("\n"),
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const violations = execution.report.violations.filter((item) => item.rule_id() === "directory-min-size");
		configuration.close_worker_session();

		expect(violations.map((item) => item.file())).toEqual(["src"]);
	});

	test("runs TypeScript file and directory diagnostics for empty source files", () => {
		const project = new InMemoryLintProject({ "src/empty.ts": "" });
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const violations = execution.report.violations.filter(
			(item) => item.rule_id() === "file-min-size" || item.rule_id() === "directory-min-size",
		);
		configuration.close_worker_session();

		expect(violations.map((item) => [item.file(), item.rule_id()])).toEqual([
			["src/empty.ts", "file-min-size"],
			["src", "directory-min-size"],
		]);
	});

	test("recomputes TypeScript directory diagnostics when the selected file set changes", () => {
		const project = new InMemoryLintProject({
			"src/first.ts": "export const first = 1;\n",
			"src/second.ts": "export const second = 2;\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const full_options = project.options(configuration);
		const first_run = configuration.lint_report(full_options, LintReportMode.PROJECT).report.violations;
		const selected_options = {
			...project.options(configuration),
			inputs: { ...full_options.inputs, files: [resolve(project.root, "src/second.ts")] },
		};
		const selected_run = configuration.lint_report(selected_options, LintReportMode.PROJECT).report.violations;
		configuration.close_worker_session();

		expect({
			full_directory_count: first_run.filter((item) => item.rule_id() === "directory-min-size").length,
			selected_directory_files: selected_run
				.filter((item) => item.rule_id() === "directory-min-size")
				.map((item) => item.file()),
		}).toEqual({ full_directory_count: 1, selected_directory_files: ["src"] });
	});

	test("reports nested TypeScript test-file placement through the AST verifier once", () => {
		const project = new InMemoryLintProject({
			"src/tests/service.test.ts": "test('returns a value', () => { expect(1).toBe(1); });\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const violations = execution.report.violations.filter((item) => item.rule_id() === "test-file-location");
		configuration.close_worker_session();

		expect(violations.map((item) => item.file())).toEqual(["src/tests/service.test.ts"]);
	});

	test("collects TypeScript missing-import and unused-file diagnostics through project AST verifiers", () => {
		const project = new InMemoryLintProject({
			"src/entry.ts": 'import { Missing } from "./missing";\nexport const entry = Missing;\n',
			"src/orphan.ts": "export const orphan = 1;\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const options = project.options(configuration, [], ["src/entry.ts"]);
		const execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const violations = execution.report.violations.filter(
			(item) => item.rule_id() === "missing-import" || item.rule_id() === "unused-file",
		);
		configuration.close_worker_session();

		expect(violations.map((item) => [item.file(), item.rule_id()])).toEqual([
			["src/entry.ts", "missing-import"],
			["src/orphan.ts", "unused-file"],
		]);
	});

	test("reports Python type aliases in the root Python functions file", () => {
		const project = new InMemoryLintProject({
			"functions.py": [
				"from typing import TypeAlias",
				"from typing_extensions import TypeAliasType",
				"Value: TypeAlias = str",
				'UserId = TypeAliasType("UserId", int)',
				"class Owner:",
				"    pass",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(project._source_io, new NodeFileIO(process.cwd()));
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const files = execution.report.violations
			.filter((item) => item.rule_id() === "functions-file-type-declaration")
			.map((item) => item.file());
		configuration.close_worker_session();

		expect({ has_diagnostic: files.length > 0, file_names: new Set(files) }).toEqual({
			has_diagnostic: true,
			file_names: new Set(["functions.py"]),
		});
	});
});
