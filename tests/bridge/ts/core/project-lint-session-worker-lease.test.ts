import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectLintExecution } from "src/core/project_lint_execution";
import { PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE } from "src/core/python-ast/constants";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstWorkerRegistry } from "src/core/python-ast/python_ast_worker_registry";
import { CommandLineOptions } from "src/core/support/command_line_options";
import { LintReportMode } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InMemoryLintProject } from "tests/core/lint-run-configuration-project";
import { TestFixture } from "tests/core/test-fixture";

describe("project lint session worker lease", () => {
	test("replaces a closed session and resumes Python lint", async () => {
		const project = new InMemoryLintProject({ "module.py": "value = 1\n" }, new InMemoryFileIO());
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const closed_session = configuration.active_worker_session();
		await closed_session.close();

		const execution = configuration.lint_report(project.options(configuration), LintReportMode.IN_MEMORY_PROJECT);
		const active_session = configuration.active_worker_session();
		const worker_is_active = active_session.worker() !== undefined;
		const result_files = execution.report.files.map((file) => file.replace(`${project.root}/`, ""));
		await active_session.close();

		expect({
			session_replaced: active_session !== closed_session,
			worker_is_active,
			result_files,
		}).toEqual({
			session_replaced: true,
			worker_is_active: true,
			result_files: ["module.py"],
		});
	});

	test("keeps the worker lease active through analysis and releases it on disposal", async () => {
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[resolve("/virtual/project/.gitignore"), ".ai-code-guard/\n"],
				[resolve("/virtual/project/source.py"), "value = 1\n"],
			]),
		);
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[resolve("/virtual/project/.gitignore"), ".ai-code-guard/\n"],
				[resolve("/virtual/project/source.py"), "value = 1\n"],
			]),
		);
		const configuration = new LintRunConfiguration(source_io, file_io);
		const worker = configuration.active_worker_session().worker();
		const command_line = new CommandLineOptions(["node", "cli.ts", "--root", "/virtual/project"]);
		const options = command_line.value();
		const execution = new ProjectLintExecution({
			lint_run_factory: configuration,
			file_io,
			source_io,
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			options,
			stage_timer: new LintStageTimer(),
		});
		const report = await execution.run();
		const analysis_completed = report.files.length === 1;
		const post_release_batch = worker.batch("after-disposal", new Map([["closed.py", "value = 2\n"]]));
		await configuration.close_worker_session();

		expect(analysis_completed).toBe(true);
		expect(() => post_release_batch.result()).toThrow(PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE);
	});

	test("reuses its worker across two analyses", async () => {
		const project = new InMemoryLintProject({ "source.py": "value = 1\n" }, new InMemoryFileIO());
		const configuration = new LintRunConfiguration(project._source_io, project._file_io);
		const worker = configuration.active_worker_session().worker();
		const options = project.options(configuration);
		const first_execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const second_execution = configuration.lint_report(options, LintReportMode.IN_MEMORY_PROJECT);
		const first_report = first_execution.report;
		const second_report = second_execution.report;
		const worker_reused = worker === configuration.active_worker_session().worker();
		await configuration.close_worker_session();

		expect([first_report.files.length, second_report.files.length, worker_reused]).toEqual([1, 1, true]);
	});

	test("reuses a live bridge across independent lint requests", () => {
		const fixture = new TestFixture();
		const first = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "first.py": "value = 1\n" },
			(configuration, options, mode) => {
				const report = configuration.lint_report(options, mode).report;
				return { worker: configuration.active_worker_session().worker(), completed: Array.isArray(report.violations) };
			},
		);
		const second = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "second.py": "value = 2\n" },
			(configuration, options, mode) => {
				const report = configuration.lint_report(options, mode).report;
				return { worker: configuration.active_worker_session().worker(), completed: Array.isArray(report.violations) };
			},
		);

		expect({
			distinct_workers: first.worker !== second.worker,
			completed: first.completed && second.completed,
		}).toEqual({
			distinct_workers: true,
			completed: true,
		});
	});

	test("shares the bridge across Jest VM contexts", () => {
		const fixture = new TestFixture();
		const bridge = new PythonAstBridge();
		fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "first.py": "def first(value):\n    return value\n" },
			(configuration, options, mode) => {
				configuration.lint_report(options, mode);
				return configuration.active_worker_session().worker();
			},
		);
		const result = runInNewContext(
			[
				"const session = new PythonAstWorkerRegistry(process).worker_session(worker_arguments, worker_options);",
				"const worker = session.worker();",
				'const parsed = worker.batch("separate-vm", new Map().set("second.py", "def second(value):\\n    return value\\n")).result();',
				"session.close();",
				"({ batch_id: parsed.batch_id, files: [...parsed.asts.keys()] })",
			].join("\n"),
			{
				process,
				PythonAstWorkerRegistry,
				worker_arguments: bridge.worker_arguments(),
				worker_options: bridge.worker_options(),
			},
		);

		expect(result).toEqual({ batch_id: "separate-vm", files: ["second.py"] });
	});
});
