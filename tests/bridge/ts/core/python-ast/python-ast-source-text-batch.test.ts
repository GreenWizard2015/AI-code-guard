import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { TestFixture } from "tests/core/test-fixture";

describe("Python parser source text batches", () => {
	test("returns an empty result without crossing the worker boundary", () => {
		const fixture = new TestFixture();
		const parser = new PythonAstData(fixture.python_ast_options());
		const stage_timer = new LintStageTimer();
		const parsed = parser.batch_ast({
			texts: [],
			stage_timer,
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});

		expect({ parsed, stages: stage_timer.durations() }).toEqual({ parsed: [], stages: [] });
	});

	test("keeps mixed cached and uncached batch results tied to their source text", () => {
		const fixture = new TestFixture();
		const parser = new PythonAstData(fixture.python_ast_options());
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
				classes: item.source.classes.map((node) => node.identity.name),
				functions: item.source.functions.map((node) => node.identity.name),
			})),
			first: first_again.source.classes.map((node) => node.identity.name),
			second: second_again.source.functions.map((node) => node.identity.name),
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
