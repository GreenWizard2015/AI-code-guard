import { PythonAstData } from "src/core/python_ast_data";
import { describe, expect, test } from "@jest/globals";
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
});
