import "src/core/lint_project_context_creator";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { PythonAstData } from "src/core/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonAstCacheConsumerFixture } from "tests/bridge/ts/core/python-ast-cache-consumer-fixture";
import { TestFixture } from "tests/core/test-fixture";

describe("Python AST disk cache consumer", () => {
	let fixture: PythonAstCacheConsumerFixture;

	beforeEach(() => {
		fixture = new PythonAstCacheConsumerFixture();
		fixture.warm_cache();
	});

	afterEach(() => {
		fixture.restore_environment();
	});

	test("restores Python diagnostics from the disk cache consumer", () => {
		const parser = new PythonAstData({
			worker: fixture.second_worker,
			analysis_identity: fixture.project.identity,
			split_batch_enabled: true,
			file_io: fixture.project.file_io,
		});
		const restored = parser.batch_ast({
			texts: [fixture.text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [fixture.file],
			repo_root: fixture.root,
		});

		expect(restored).toEqual(
			expect.arrayContaining([expect.objectContaining({ parse_issues: [{ line: 0, message: "syntax error" }] })]),
		);
	});

	test("reuses the warm cache without invoking the worker", () => {
		const parser = new PythonAstData({
			worker: fixture.second_worker,
			analysis_identity: fixture.project.identity,
			split_batch_enabled: true,
			file_io: fixture.project.file_io,
		});
		parser.batch_ast({
			texts: [fixture.text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [fixture.file],
			repo_root: fixture.root,
		});
		expect(fixture.second_worker.calls).toBe(0);
	});

	test("keeps mixed cached and uncached batch results tied to their source text", () => {
		const test_fixture = new TestFixture();
		const parser = new PythonAstData(test_fixture.python_ast_options());
		const first = "class First:\n    pass\n";
		const second = "def second():\n    pass\n";

		parser.source_ast(first);
		const parsed = parser.batch_ast({
			texts: [first, second],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});
		const first_again = parser.source_ast(first);
		const second_again = parser.source_ast(second);

		expect({
			batch: parsed.map((item) => ({
				classes: item.classes.map((node) => node.name),
				functions: item.functions.map((node) => node.name),
			})),
			first: first_again.classes.map((node) => node.name),
			second: second_again.functions.map((node) => node.name),
		}).toEqual({
			batch: [
				{ classes: ["First"], functions: [] },
				{ classes: [], functions: ["second"] },
			],
			first: ["First"],
			second: ["second"],
		});
	});
});
