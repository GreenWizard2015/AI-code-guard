import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { NODE_ENV_VARIABLE } from "src/core/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { LintReportMode } from "src/core/types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InMemoryLintProject } from "tests/core/lint-run-configuration-project";

describe("in-memory lint project policy", () => {
	const previous_environment = process.env[NODE_ENV_VARIABLE];

	beforeAll(() => {
		process.env[NODE_ENV_VARIABLE] = "production";
	});

	afterAll(() => {
		if (previous_environment === undefined) {
			delete process.env[NODE_ENV_VARIABLE];
		} else {
			process.env[NODE_ENV_VARIABLE] = previous_environment;
		}
	});

	test("omits configured entry classes from unused-symbol diagnostics", () => {
		const project = new InMemoryLintProject({ "bootstrap.ts": "export class Bootstrap {}\n" }, new InMemoryFileIO());
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration, [], ["bootstrap.ts"]);
		const execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const unused_classes = execution.report.violations.filter((item) => item.rule_id() === "unused-class");
		configuration.close_worker_session();

		expect({ files: unused_classes.length }).toEqual({ files: 0 });
	});

	test("reports unused files when no entry file is configured", async () => {
		const project = new InMemoryLintProject({ "src/feature.ts": "export const feature = 1;\n" }, new InMemoryFileIO());
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration);
		const execution = configuration.lint_report({ ...options, entry_files: [] }, LintReportMode.PROJECT);
		const files = execution.report.violations
			.filter((item) => item.rule_id() === "unused-file")
			.map((item) => item.file());
		await configuration.close_worker_session();

		expect(files).toEqual(["src/feature.ts"]);
	});

	test("omits unused-file diagnostics for a configured entry file", async () => {
		const project = new InMemoryLintProject({ "src/feature.ts": "export const feature = 1;\n" }, new InMemoryFileIO());
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration);
		const execution = configuration.lint_report(
			{ ...options, entry_files: ["src/feature.ts"] },
			LintReportMode.PROJECT,
		);
		const files = execution.report.violations
			.filter((item) => item.rule_id() === "unused-file")
			.map((item) => item.file());
		await configuration.close_worker_session();

		expect(files).toEqual([]);
	});

	test("keeps project inventory stable when files are ignored", async () => {
		const project = new InMemoryLintProject(
			{
				"src/a.ts": "export class A {}\n",
				"src/b.ts": "export class B {}\n",
				"src/c.ts": "export class C {}\n",
			},
			new InMemoryFileIO(),
		);
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration);
		const ignored_options = {
			...options,
			inputs: { ...options.inputs, ignored_files: [resolve(project.root, "src/c.ts")] },
		};
		const selected_files = ignored_options.inputs.files;
		const original_files = options.inputs.files;
		await configuration.close_worker_session();

		expect({ selected_files, original_files }).toEqual({
			selected_files: original_files,
			original_files,
		});
	});

	test("recomputes cached directory diagnostics when ignored files change", async () => {
		const project = new InMemoryLintProject(
			{
				"src/a.ts": "export class A {}\n",
				"src/b.ts": "export class B {}\n",
				"src/c.ts": "export class C {}\n",
			},
			new InMemoryFileIO(),
		);
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration);
		const before = configuration.lint_report(options, LintReportMode.PROJECT).report.violations;
		const ignored_options = {
			...options,
			inputs: { ...options.inputs, ignored_files: [resolve(project.root, "src/c.ts")] },
		};
		const after = configuration.lint_report(ignored_options, LintReportMode.PROJECT).report.violations;
		const before_paths = before
			.filter((item) => item.rule_id() === "directory-class-min-size")
			.map((item) => item.file());
		const after_paths = after
			.filter((item) => item.rule_id() === "directory-class-min-size")
			.map((item) => item.file());
		await configuration.close_worker_session();

		expect({ before_paths, after_paths }).toEqual({ before_paths: [], after_paths: ["src"] });
	});

	test("recomputes in-memory directory diagnostics when ignored files change", async () => {
		const project = new InMemoryLintProject(
			{
				"src/a.ts": "export class A {}\n",
				"src/b.ts": "export class B {}\n",
				"src/c.ts": "export class C {}\n",
			},
			new InMemoryFileIO(),
		);
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const options = project.options(configuration);
		const before = configuration.lint_report(options, LintReportMode.PROJECT).report.violations;
		const ignored_options = {
			...options,
			inputs: { ...options.inputs, ignored_files: [resolve(project.root, "src/c.ts")] },
		};
		const after = configuration.lint_report(ignored_options, LintReportMode.IN_MEMORY_PROJECT).report.violations;
		const before_paths = before
			.filter((item) => item.rule_id() === "directory-class-min-size")
			.map((item) => item.file());
		const after_paths = after
			.filter((item) => item.rule_id() === "directory-class-min-size")
			.map((item) => item.file());
		await configuration.close_worker_session();

		expect({ before_paths, after_paths }).toEqual({ before_paths: [], after_paths: ["src"] });
	});

	test("reports an ignored state directory from cached ignore configuration", async () => {
		const file_io = new InMemoryFileIO();
		const project = new InMemoryLintProject(
			{ ".gitignore": ".ai-code-guard/\n", "src/a.ts": "export class A {}\n" },
			file_io,
		);
		const configuration = new LintRunConfiguration(project._source_io, file_io);
		const execution = configuration.lint_report(project.options(configuration), LintReportMode.PROJECT);
		const files = execution.report.violations
			.filter((item) => item.rule_id() === "ai-code-guard-directory-ignored")
			.map((item) => item.file());
		await configuration.close_worker_session();

		expect(files).toEqual([]);
	});

	test("invalidates file diagnostics when cached ignore configuration text changes", async () => {
		const file_io = new InMemoryFileIO();
		const initial_project = new InMemoryLintProject(
			{ ".gitignore": ".ai-code-guard/\n", "src/a.ts": "export class A {}\n" },
			file_io,
		);
		const initial_configuration = new LintRunConfiguration(initial_project._source_io, file_io);
		const initial_report = initial_configuration.lint_report(
			initial_project.options(initial_configuration),
			LintReportMode.PROJECT,
		);
		const initial_files = initial_report.report.violations
			.filter((item) => item.rule_id() === "ai-code-guard-directory-ignored")
			.map((item) => item.file());
		await initial_configuration.close_worker_session();
		const updated_project = new InMemoryLintProject({ ".gitignore": "", "src/a.ts": "export class A {}\n" }, file_io);
		const updated_configuration = new LintRunConfiguration(updated_project._source_io, file_io);
		const updated_report = updated_configuration.lint_report(
			updated_project.options(updated_configuration),
			LintReportMode.PROJECT,
		);
		const updated_files = updated_report.report.violations
			.filter((item) => item.rule_id() === "ai-code-guard-directory-ignored")
			.map((item) => item.file());
		await updated_configuration.close_worker_session();

		expect({ initial_files, updated_files }).toEqual({
			initial_files: [],
			updated_files: [".ai-code-guard"],
		});
	});
});
