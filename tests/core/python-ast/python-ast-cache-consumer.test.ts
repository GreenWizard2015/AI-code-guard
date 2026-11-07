import "src/core/lint_project_context_creator";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonAstCacheConsumerFixture } from "tests/bridge/ts/core/python-ast-cache-consumer-fixture";

describe("Python AST disk cache consumer", () => {
	let fixture: PythonAstCacheConsumerFixture;

	beforeEach(() => {
		fixture = new PythonAstCacheConsumerFixture();
		fixture.warm_cache();
	});

	test("restores Python diagnostics from the disk cache consumer", () => {
		const parser = new PythonAstData({
			worker: fixture._second_worker,
			analysis_identity: fixture._project._identity,
			split_batch_enabled: true,
			file_io: fixture._project._file_io,
			cache_enabled: true,
		});
		const restored = parser.batch_ast({
			texts: [fixture._text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [fixture._file],
			repo_root: fixture._root,
		});

		expect(restored).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: expect.objectContaining({ parse_issues: [{ line: 0, message: "syntax error" }] }),
				}),
			]),
		);
	});

	test("reuses the warm cache without invoking the worker", () => {
		const parser = new PythonAstData({
			worker: fixture._second_worker,
			analysis_identity: fixture._project._identity,
			split_batch_enabled: true,
			file_io: fixture._project._file_io,
			cache_enabled: true,
		});
		parser.batch_ast({
			texts: [fixture._text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [fixture._file],
			repo_root: fixture._root,
		});
		expect(fixture._second_worker.call_count()).toBe(0);
	});
});
