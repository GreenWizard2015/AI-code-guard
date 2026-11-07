import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { InMemoryLintProject } from "tests/core/lint-run-configuration-project";

describe("in-memory lint project policy", () => {
	test("omits configured entry classes from unused-symbol diagnostics", () => {
		const project = new InMemoryLintProject({ "bootstrap.ts": "export class Bootstrap {}\n" });
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration, [], ["bootstrap.ts"]);
		const execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const unused_classes = execution.report.violations.filter((item) => item.rule_id() === "unused-class");
		configuration.close_worker_session();

		expect({ files: unused_classes.length }).toEqual({ files: 0 });
	});

	test("recomputes unused-file diagnostics when entry files change", () => {
		const project = new InMemoryLintProject({ "src/feature.ts": "export const feature = 1;\n" });
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const inventory_options = project.options(configuration);
		const without_entry = configuration
			.lint_report({ ...inventory_options, entry_files: [] }, LintReportMode.PROJECT)
			.report.violations.filter((item) => item.rule_id() === "unused-file");
		const with_entry = configuration
			.lint_report({ ...inventory_options, entry_files: ["src/feature.ts"] }, LintReportMode.PROJECT)
			.report.violations.filter((item) => item.rule_id() === "unused-file");
		configuration.close_worker_session();

		expect({
			without_entry: without_entry.map((item) => item.file()),
			with_entry: with_entry.map((item) => item.file()),
		}).toEqual({ without_entry: ["src/feature.ts"], with_entry: [] });
	});

	test("recomputes project file diagnostics when ignored files change", () => {
		const project = new InMemoryLintProject({
			"src/a.ts": "export class A {}\n",
			"src/b.ts": "export class B {}\n",
			"src/c.ts": "export class C {}\n",
		});
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const inventory_options = project.options(configuration);
		const ignored_file = resolve(project.root, "src/c.ts");
		const ignored_options = {
			...inventory_options,
			inputs: { ...inventory_options.inputs, ignored_files: [ignored_file] },
		};
		const before_ignore = configuration.lint_report(inventory_options, LintReportMode.PROJECT).report.violations;
		const cached_after_ignore = configuration.lint_report(ignored_options, LintReportMode.PROJECT).report.violations;
		const uncached_after_ignore = configuration.lint_report(ignored_options, LintReportMode.IN_MEMORY_PROJECT).report
			.violations;
		configuration.close_worker_session();
		/** Responsibilities: _directory diagnostic paths_. **/
		const directory_diagnostics = (violations: typeof before_ignore): string[] =>
			violations.filter((item) => item.rule_id() === "directory-class-min-size").map((item) => item.file());

		expect({
			inventory_unchanged: ignored_options.inputs.files,
			original_inventory: inventory_options.inputs.files,
			before_ignore: directory_diagnostics(before_ignore),
			cached_after_ignore: directory_diagnostics(cached_after_ignore),
			uncached_after_ignore: directory_diagnostics(uncached_after_ignore),
		}).toEqual({
			inventory_unchanged: inventory_options.inputs.files,
			original_inventory: inventory_options.inputs.files,
			before_ignore: [],
			cached_after_ignore: ["src"],
			uncached_after_ignore: ["src"],
		});
	});
});
