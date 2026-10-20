import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { resolve } from "node:path";
import type { LintReportOptions } from "src/core/types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _in-memory lint project ownership_, _configuration lifecycle_. **/
class InMemoryLintProject {
	public readonly root = "/virtual/lint-run-project";
	public readonly source_texts: ReadonlyMap<string, string>;
	public readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _virtual source snapshot construction_. **/
	public constructor(files: Record<string, string>) {
		const absolute_sources = new Map(Object.entries(files).map(([file, text]) => [resolve(this.root, file), text]));
		this.source_texts = absolute_sources;
		this.source_io = new InMemoryProjectSourceIO(absolute_sources);
	}

	/** Responsibilities: _lint request preparation_. **/
	public options(
		configuration: LintRunConfiguration,
		ignored_directories: readonly string[] = [],
		entry_files: readonly string[] = [],
	): LintReportOptions {
		const inputs = configuration.input_file_selector.input_files(this.root, ignored_directories, []);
		return {
			repo_root: this.root,
			ignored_directories,
			stage_timer: new LintStageTimer(),
			inputs,
			source_texts: this.source_texts,
			entry_files,
		};
	}
}

describe("in-memory lint run configuration", () => {
	test("excludes ignored files from selected lint targets", () => {
		const project = new InMemoryLintProject({
			"kept.ts": "export const kept = 1;\n",
			"ignored/ignored.ts": "export const ignored = 1;\n",
		});
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const files = configuration.input_file_selector.input_files(project.root, ["ignored"], []).files;
		configuration.python_ast_worker.close();
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/\/kept\.ts$/u);
	});

	test("keeps ignored production files in project context", () => {
		const project = new InMemoryLintProject({
			"kept.ts": "export const kept = 1;\n",
			"ignored/ignored.ts": "export const ignored = 1;\n",
		});
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const execution = configuration.lint_report(
			project.options(configuration, ["ignored"]),
			LintReportMode.IN_MEMORY_PROJECT,
		);
		const files = execution.context.files().map((file) => file.absolute_path);
		configuration.python_ast_worker.close();
		expect(files.sort()).toEqual([resolve(project.root, "ignored/ignored.ts"), resolve(project.root, "kept.ts")]);
	});

	test("classifies ignored imports as production targets for tests", () => {
		const project = new InMemoryLintProject({
			"external/service.ts": "export class Service {}\n",
			"tests/external/service.test.ts": [
				'import { Service } from "../../external/service";',
				"test('uses the service', () => {",
				"  const service = new Service();",
				"  expect(service).toBeInstanceOf(Service);",
				"});",
			].join("\n"),
		});
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const options = project.options(configuration, ["external"]);
		const execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const external_file = resolve(project.root, "external/service.ts");
		const source = execution.context.source_record(external_file);
		const test_target_problem = execution.report.violations.some(
			(item) => item.file === "tests/external/service.test.ts" && item.rule_id === "test-targets",
		);
		const result = {
			selected_for_lint: options.inputs.files.includes(external_file),
			included_in_project: options.inputs.project_files.includes(external_file),
			marked_ignored: options.inputs.ignored_files.includes(external_file),
			classified_as_product: source.file_name.product(),
			resolves_as_test_target: !test_target_problem,
		};
		configuration.python_ast_worker.close();

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
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const first = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.file === "functions.ts");
		const second = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.file === "functions.ts");
		configuration.python_ast_worker.close();
		expect(second.map((item) => item.details())).toEqual(first.map((item) => item.details()));
		expect(second.length).toBeGreaterThan(0);
	});

	test("omits configured entry classes from unused-symbol diagnostics", () => {
		const project = new InMemoryLintProject({ "bootstrap.ts": "export class Bootstrap {}\n" });
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const unused_classes = configuration
			.lint_report(project.options(configuration, [], ["bootstrap.ts"]), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.rule_id === "unused-class");
		configuration.python_ast_worker.close();
		expect(unused_classes).toHaveLength(0);
	});

	test("reports each type declaration in the root TypeScript functions file", () => {
		const project = new InMemoryLintProject({
			"functions.ts": ["type Value = string;", "interface Port {}", "enum State { Ready }", "class Owner {}"].join(
				"\n",
			),
		});
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const files = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.rule_id === "functions-file-type-declaration")
			.map((item) => item.file);
		configuration.python_ast_worker.close();
		expect(files).toEqual(["functions.ts", "functions.ts", "functions.ts", "functions.ts"]);
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
		const configuration = new LintRunConfiguration(project.source_io, new NodeFileIO());
		const files = configuration
			.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT)
			.report.violations.filter((item) => item.rule_id === "functions-file-type-declaration")
			.map((item) => item.file);
		configuration.python_ast_worker.close();
		expect(files.length).toBeGreaterThan(0);
		expect(new Set(files)).toEqual(new Set(["functions.py"]));
	});
});
