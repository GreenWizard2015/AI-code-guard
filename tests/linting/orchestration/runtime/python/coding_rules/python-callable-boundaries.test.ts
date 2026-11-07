import { describe, expect, test } from "@jest/globals";
import { PythonTypeRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_type_rule_collector";
import { ParsedSourceFiles } from "tests/bridge/ts/runner/orchestration/runtime/parsed_source_files";

describe("coding-lint Python callable boundaries", () => {
	const source_files = new ParsedSourceFiles();

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
		const collector = new PythonTypeRuleCollector(input);
		collector.append_type_rules();

		expect(
			input.violations.filter((item) => item.rule_id() === "explicit-return-type").map((item) => item.line()),
		).toEqual([5]);
	});

	test("requires return types on nested async Python functions", () => {
		const input = source_files.rule_input(
			"nested-async-callable.py",
			["def outer() -> str:", "\tasync def candidate(value: str):", "\t\treturn value", '\treturn "value"'].join("\n"),
		);
		const collector = new PythonTypeRuleCollector(input);
		collector.append_type_rules();

		expect(
			input.violations.filter((item) => item.rule_id() === "explicit-return-type").map((item) => item.line()),
		).toEqual([2]);
	});
});
