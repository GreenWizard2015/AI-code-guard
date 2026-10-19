import { describe, expect, test } from "@jest/globals";
import { PythonRuleCollector } from "src/linting/orchestration/runtime/python/python_rule_collector";
import { ParsedPythonSource } from "tests/bridge/ts/runner/orchestration/runtime/parsed_python_source";

describe("coding-lint Python callable boundaries", () => {
	const source_files = new ParsedPythonSource();

	test("requires return types on nested Python functions", () => {
		const input = source_files.rule_input(
			"nested-callable.py",
			[
				"def control(value: str) -> str:",
				"\treturn value",
				"",
				"def outer() -> str:",
				"\tdef candidate(value: str):",
				"\t\treturn value",
				'\treturn candidate("value")',
			].join("\n"),
		);
		const collector = new PythonRuleCollector(input);
		collector.append_metrics();

		expect(input.violations.filter((item) => item.rule_id === "explicit-return-type")).toEqual([
			expect.objectContaining({ line: 5 }),
		]);
	});

	test("requires return types on nested async Python functions", () => {
		const input = source_files.rule_input(
			"nested-async-callable.py",
			["def outer() -> str:", "\tasync def candidate(value: str):", "\t\treturn value", '\treturn "value"'].join("\n"),
		);
		const collector = new PythonRuleCollector(input);
		collector.append_metrics();

		expect(input.violations.filter((item) => item.rule_id === "explicit-return-type")).toEqual([
			expect.objectContaining({ line: 2 }),
		]);
	});
});
