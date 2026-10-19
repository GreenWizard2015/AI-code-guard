import { describe, expect, test } from "@jest/globals";
import { runInNewContext } from "node:vm";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonAstWorkerSession } from "external/python_ast_worker_session.mjs";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Jest worker Python bridge reuse", () => {
	test("shares one active bridge across independent lint requests", () => {
		const fixture = new TestFixture();
		const first_result = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "first.py": "value = 1\n" },
			(configuration, options, mode) => {
				const report = configuration.lint_report(options, mode).report;
				return { worker: configuration.python_ast_worker, completed: Array.isArray(report.violations) };
			},
		);
		const second_result = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "second.py": "value = 2\n" },
			(configuration, options, mode) => {
				const report = configuration.lint_report(options, mode).report;
				return { worker: configuration.python_ast_worker, completed: Array.isArray(report.violations) };
			},
		);

		expect({
			same_worker_reused: first_result.worker === second_result.worker,
			both_requests_completed: first_result.completed && second_result.completed,
		}).toEqual({ same_worker_reused: true, both_requests_completed: true });
	});

	test("keeps the bridge across independent Jest VM contexts", () => {
		const fixture = new TestFixture();
		const bridge = new PythonAstBridge();
		const first_worker = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "first.py": "def first(value):\n    return value\n" },
			(configuration, options, mode) => {
				configuration.lint_report(options, mode);
				return configuration.python_ast_worker;
			},
		);

		const result = runInNewContext(
			[
				"const session = new PythonAstWorkerSession(process, worker_arguments, worker_options);",
				"const worker = session.worker_instance;",
				'const parsed = worker.batch_result("separate-vm", { "second.py": "def second(value):\\n    return value\\n" });',
				"({ same_worker: worker === expected_worker, batch_id: parsed.batchId, files: [...parsed.asts.keys()] })",
			].join("\n"),
			{
				process,
				PythonAstWorkerSession,
				worker_arguments: bridge.worker_arguments(),
				worker_options: bridge.worker_options(),
				expected_worker: first_worker,
			},
		);

		expect(result).toEqual({
			same_worker: true,
			batch_id: "separate-vm",
			files: ["second.py"],
		});
	});
});
