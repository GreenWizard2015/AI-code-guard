import { describe, expect, test } from "@jest/globals";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import type { PythonBatchAstOptions } from "src/model/ast/normalized_ast_types";
import { PythonAstBatchScenario } from "tests/bridge/ts/core/python_ast_batch_test_support";

describe("Python AST batch response validation", () => {
	test("maps a large named response without scanning earlier entries", () => {
		const scenario = new PythonAstBatchScenario();
		const parser = new PythonAstData(scenario.parser_options());
		const texts = Array.from({ length: 1000 }, (_, index) => `class Item${index}:\n    pass\n`);
		const parsed = parser.batch_ast(scenario.batch_options(texts));

		expect(parsed).toHaveLength(1000);
	});

	test("rejects an incomplete worker response without changing valid batch results", () => {
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const complete_scenario = new PythonAstBatchScenario();
		const complete_parser = new PythonAstData(complete_scenario.parser_options());
		const complete = complete_parser.batch_ast(complete_scenario.batch_options(texts));
		const incomplete_scenario = new PythonAstBatchScenario("1");
		const incomplete_parser = new PythonAstData(incomplete_scenario.parser_options());
		expect(complete).toHaveLength(2);
		expect(() => incomplete_parser.batch_ast(incomplete_scenario.batch_options(texts))).toThrow(
			"Python AST worker returned an incomplete batch.",
		);
	});

	test("records bridge timing stages from the worker response", () => {
		const scenario = new PythonAstBatchScenario();
		const parser = new PythonAstData(scenario.parser_options());
		const stage_timer = new LintStageTimer();
		const options = { ...scenario.batch_options(["class First:\n    pass\n"]), stage_timer };
		parser.batch_ast(options);

		expect(stage_timer.durations().map((stage) => stage.name)).toContain(
			"python-bridge.bridge-round-trip.python-ast-parse",
		);
		expect(stage_timer.durations().map((stage) => stage.name)).toContain(
			"python-bridge.bridge-round-trip.python-ast-build",
		);
	});

	test("rejects a stale single batch identifier", () => {
		const valid_scenario = new PythonAstBatchScenario();
		const valid_parser = new PythonAstData(valid_scenario.parser_options());
		const scenario = new PythonAstBatchScenario("", "stale-single-batch");
		const parser = new PythonAstData(scenario.parser_options());
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const parsed = valid_parser.batch_ast(valid_scenario.batch_options(texts));
		expect(parsed).toHaveLength(2);
		expect(() => parser.batch_ast(scenario.batch_options(texts))).toThrow(
			"Python AST worker returned an unexpected batch id.",
		);
	});

	test("rejects a stale split batch identifier", () => {
		const valid_scenario = new PythonAstBatchScenario();
		const valid_parser = new PythonAstData(valid_scenario.parser_options());
		const scenario = new PythonAstBatchScenario("", "stale-split-batch");
		const parser = new PythonAstData(scenario.parser_options());
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const batch_id = parser.begin_batch_ast(scenario.batch_options(texts));
		const parsed = valid_parser.batch_ast(valid_scenario.batch_options(texts));
		expect(parsed).toHaveLength(2);
		expect(() => parser.complete_batch_ast(batch_id)).toThrow("Python AST worker returned an unexpected batch id.");
	});

	test("cancels an abandoned split batch before parsing a retry", () => {
		const scenario = new PythonAstBatchScenario();
		const parser = new PythonAstData(scenario.parser_options());
		const options = scenario.batch_options(["class First:\n    pass\n"]);
		const abandoned_batch = parser.begin_batch_ast(options);
		parser.cancel_batch_ast(abandoned_batch);
		const retry_batch = parser.begin_batch_ast(options);
		const retry_results = parser.complete_batch_ast(retry_batch);

		expect({ abandoned_batch, retry_batch: retry_batch.length > 0, retry_results: retry_results.length }).toEqual({
			abandoned_batch: expect.any(String),
			retry_batch: true,
			retry_results: 1,
		});
	});

	test("reparses a source revision after a newer project snapshot replaces it", () => {
		const scenario = new PythonAstBatchScenario();
		const parser = new PythonAstData(scenario.parser_options());
		/** Responsibilities: _Python AST options_. **/
		const options = (text: string): PythonBatchAstOptions => ({
			...scenario.batch_options([text]),
			files: ["module.py"],
		});
		const first_revision_results = parser.batch_ast(options("class Item:\n    value = 1\n"));
		parser.batch_ast(options("class Item:\n    value = 2\n"));
		const restored_revision_results = parser.batch_ast(options("class Item:\n    value = 1\n"));
		const first_revision = first_revision_results.at(0);
		const restored_revision = restored_revision_results.at(0);

		expect(restored_revision).not.toBe(first_revision);
	});
});
