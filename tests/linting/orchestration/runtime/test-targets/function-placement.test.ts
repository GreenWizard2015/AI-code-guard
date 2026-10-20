import { FunctionPlacementRules } from "src/linting/orchestration/runtime/test-targets/function_placement_rules";
import type { PlacementFunctionNode } from "src/model/types/types";
import type { ViolationContract } from "src/reporting_protocols";
import { describe, expect, test } from "@jest/globals";

describe("function placement rules", () => {
	test("requires root functions files to keep free functions inside domain classes", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_domain(violations, "functions.ts", functions);

		expect(violations.map((item) => [item.rule_id, item.line])).toEqual([["functions-file-domain-class", 1]]);
	});

	test("applies the domain-class requirement to root Python functions files", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_domain(violations, "functions.py", functions);

		expect(violations.map((item) => item.rule_id)).toEqual(["functions-file-domain-class"]);
	});

	test("does not report methods nested in a root domain class", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const methods: PlacementFunctionNode[] = [{ start: 1, nested: true }];

		rules.append_domain(violations, "functions.ts", methods);

		expect(violations).toEqual([]);
	});

	test("requires TypeScript module functions to live in the project-root functions file", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "worker.ts", functions);

		expect(violations.map((item) => [item.rule_id, item.line, item.message])).toEqual([
			["function-placement", 1, "module-level functions must be declared in the project-root functions file"],
		]);
	});

	test("requires Python module functions to live in the project-root functions file", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "worker.py", functions);

		expect(violations.map((item) => [item.rule_id, item.message])).toEqual([
			["function-placement", "module-level functions must be declared in the project-root functions file"],
		]);
	});

	test("does not treat class methods as module-level functions", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const methods: PlacementFunctionNode[] = [{ start: 1, nested: true }];

		rules.append_module(violations, "worker.ts", methods);

		expect(violations).toEqual([]);
	});

	test("allows one CLI entry-point function", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_cli(violations, "cli.ts", functions);
		rules.append_module(violations, "cli.ts", functions);

		expect(violations).toEqual([]);
	});

	test("limits CLI modules to one entry-point function in both languages", () => {
		const rules = new FunctionPlacementRules();
		const typescript_violations: ViolationContract[] = [];
		const python_violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [
			{ start: 0, nested: false },
			{ start: 1, nested: false },
		];

		rules.append_cli(typescript_violations, "cli.ts", functions);
		rules.append_cli(python_violations, "cli.py", functions);

		expect(typescript_violations.map((item) => [item.rule_id, item.line])).toEqual([["cli-file-function-count", 2]]);
		expect(python_violations.map((item) => [item.rule_id, item.line])).toEqual([["cli-file-function-count", 2]]);
	});

	test("requires the exact functions filename", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "functions.worker.ts", functions);

		expect(violations).toHaveLength(1);
	});

	test("accepts only the exact functions filename", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "functions.ts", functions);

		expect(violations).toEqual([]);
	});

	test("rejects a functions file nested under a functions directory", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "functions/functions.ts", functions);

		expect(violations).toHaveLength(1);
	});

	test("rejects an exact functions filename outside the project root", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 0, nested: false }];

		rules.append_module(violations, "src/functions.ts", functions);

		expect(violations).toHaveLength(1);
	});

	test("also checks Python bridge modules", () => {
		const rules = new FunctionPlacementRules();
		const violations: ViolationContract[] = [];
		const functions: PlacementFunctionNode[] = [{ start: 10, nested: false }];

		rules.append_module(violations, "src/python-bridge/python_ast_bridge.py", functions);

		expect(violations).toHaveLength(1);
	});
});
