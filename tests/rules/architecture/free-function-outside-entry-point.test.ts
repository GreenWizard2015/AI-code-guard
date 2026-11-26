import { describe, expect, test } from "@jest/globals";
import { FUNCTION_MODULE_NAMES } from "src/constants";
import type { ViolationContract } from "src/reporting_protocols";
import { FunctionPlacementRules } from "src/rules/architecture/function_placement_rules";

describe("function placement by file category", () => {
	test("requires root functions files to keep free functions inside domain classes", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"functions.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations.map((item) => [item.rule_id(), item.line()])).toEqual([["functions-file-domain-class", 1]]);
	});

	test("applies the domain-class requirement to root Python functions files", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"functions.py",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations.map((item) => item.rule_id())).toEqual(["functions-file-domain-class"]);
	});

	test("does not report methods nested in a root domain class", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"functions.ts",
			[
				{
					identity: { name: "run", owner: "Owner", nested: true, start: 1, end: 2, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toEqual([]);
	});

	test("requires TypeScript module functions to live in the project-root functions file", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"worker.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations.map((item) => [item.rule_id(), item.line(), item.priority(), item.message()])).toEqual([
			[
				"free-function-outside-entry-point",
				1,
				7,
				"module-level free functions must be moved into a class or recognized entry point",
			],
		]);
	});

	test("requires Python module free functions to move into a class", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"worker.py",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations.map((item) => [item.rule_id(), item.priority(), item.message()])).toEqual([
			[
				"free-function-outside-entry-point",
				7,
				"module-level free functions must be moved into a class or recognized entry point",
			],
		]);
	});

	test("does not treat class methods as module-level functions", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"worker.ts",
			[
				{
					identity: { name: "run", owner: "Owner", nested: true, start: 1, end: 2, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toEqual([]);
	});

	test("allows one free function in a recognized entry point regardless of filename", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"scripts/start.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			true,
		);

		expect(violations).toEqual([]);
	});

	test("limits recognized entry-point files to one free function in both languages", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const typescript_violations: ViolationContract[] = [];
		const python_violations: ViolationContract[] = [];
		rules.append(
			typescript_violations,
			"scripts/start.ts",
			[
				{ identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" } },
				{ identity: { name: "execute", owner: "", nested: false, start: 1, end: 2, visibility: "public" } },
			],
			true,
		);
		rules.append(
			python_violations,
			"tools/start.py",
			[
				{ identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" } },
				{ identity: { name: "execute", owner: "", nested: false, start: 1, end: 2, visibility: "public" } },
			],
			true,
		);

		expect(typescript_violations.map((item) => [item.rule_id(), item.line()])).toEqual([
			["entry-point-function-count", 2],
		]);
		expect(python_violations.map((item) => [item.rule_id(), item.line()])).toEqual([["entry-point-function-count", 2]]);
	});

	test("does not exempt a file just because it is named cli", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];

		rules.append(
			violations,
			"cli.ts",
			[{ identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" } }],
			false,
		);

		expect(violations.map((item) => item.rule_id())).toEqual(["free-function-outside-entry-point"]);
	});

	test("requires the exact functions filename", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"functions.worker.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toHaveLength(1);
	});

	test("rejects a functions file nested under a functions directory", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"functions/functions.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toHaveLength(1);
	});

	test("rejects an exact functions filename outside the project root", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"src/functions.ts",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 0, end: 1, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toHaveLength(1);
	});

	test("also checks Python bridge modules", () => {
		const rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		const violations: ViolationContract[] = [];
		rules.append(
			violations,
			"src/python-bridge/python_ast_bridge.py",
			[
				{
					identity: { name: "run", owner: "", nested: false, start: 10, end: 11, visibility: "public" },
				},
			],
			false,
		);

		expect(violations).toHaveLength(1);
	});
});
