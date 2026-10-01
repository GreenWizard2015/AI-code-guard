import "src/bridge/ts/parser-internals/typescript-node-rules";
import "src/bridge/ts/parser-internals/typescript-structural-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint operator precedence rules", () => {
	test("requires grouping for mixed boolean and arithmetic operators", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"operators.ts": [
				"const mixed_boolean = first && second || third;",
				"const ungrouped_comparison = enabled || count > 0;",
				"const reversed_comparison = count > 0 || enabled;",
				"const and_comparison = enabled && count > 0;",
				"const reversed_and_comparison = count > 0 && enabled;",
				"const negated_comparison = !enabled || count > 0;",
				"const call_left = is_ready() || count > 0;",
				"const call_right = count > 0 || is_ready();",
				"const new_boolean = new Boolean(value) || count > limit;",
				"const { flags: alias_flags } = input;",
				"const indexed_alias = alias_flags[0] || count > 0;",
				"const as_wrapped = enabled as boolean || count > 0;",
				"const satisfies_wrapped = enabled satisfies boolean || count > 0;",
				"const non_null_wrapped = enabled! || count > 0;",
				"const type_asserted = <boolean>enabled || count > 0;",
				"async function awaited_value(): Promise<boolean> { return await is_ready() || count > 0; }",
				"const conditional = enabled ? ready : false || count > 0;",
				"const parenthesized_chain = (first && second || third);",
				"const flattened_or = first || second || count > 0;",
				"const flattened_and = first && second && count > 0;",
				"const mixed_arithmetic = first + second / third;",
				"const parenthesized_arithmetic = (first + second / third);",
				"const grouped_boolean = first && (second || third);",
				"const grouped_comparison = enabled || (count > 0);",
				"const grouped_arithmetic = first + (second / third);",
			].join("\n"),
			"operators.py": [
				"mixed_boolean = first and second or third",
				"ungrouped_comparison = enabled or count > 0",
				"reversed_comparison = count > 0 or enabled",
				"and_comparison = enabled and count > 0",
				"reversed_and_comparison = count > 0 and enabled",
				"negated_comparison = not enabled or count > 0",
				"call_left = is_ready() or count > 0",
				"call_right = count > 0 or is_ready()",
				"indexed_left = flags[0] or count > 0",
				"async def awaited_value() -> bool:\n    return await is_ready() or count > 0",
				"assigned = (ready := ready_now()) or count > 0",
				"conditional = state.enabled if state is not None else False or count > 0",
				"parenthesized_chain = (first and second or third)",
				"flattened_or = first or second or count > 0",
				"flattened_and = first and second and count > 0",
				"mixed_arithmetic = first + second / third",
				"parenthesized_arithmetic = (first + second / third)",
				"grouped_boolean = first and (second or third)",
				"grouped_comparison = enabled or (count > 0)",
				"grouped_arithmetic = first + (second / third)",
			].join("\n"),
		});
		const boolean_violations = violations.filter((item) => item.rule_id === "mixed-boolean-precedence");
		const arithmetic_violations = violations.filter((item) => item.rule_id === "mixed-arithmetic-precedence");

		expect({
			boolean_count: boolean_violations.length,
			typescript_boolean_count: boolean_violations.filter((item) => item.file.endsWith("operators.ts")).length,
			python_boolean_count: boolean_violations.filter((item) => item.file.endsWith("operators.py")).length,
			arithmetic_count: arithmetic_violations.length,
		}).toEqual({
			boolean_count: 33,
			typescript_boolean_count: 19,
			python_boolean_count: 14,
			arithmetic_count: 4,
		});
	});

	test("counts logical parts inside parentheses", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"logical.ts":
				"function ready(first: boolean, second: boolean, third: boolean, fourth: boolean): boolean { return first || (second && third) || fourth; }",
			"logical.py":
				"def ready(first: bool, second: bool, third: bool, fourth: bool) -> bool:\n    return first or (second and third) or fourth",
		});
		const logical = violations.filter((item) => item.rule_id === "logical-chain-size");

		expect({
			count: logical.length,
			typescript: logical.some((item) => item.file.endsWith("logical.ts")),
			python: logical.some((item) => item.file.endsWith("logical.py")),
		}).toEqual({ count: 2, typescript: true, python: true });
	});

	test("checks mixed operators inside a parenthesized subexpression", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"nested.ts": "const total = base + (first * second + third);",
			"nested.py": "total = base + (first * second + third)",
		});
		const arithmetic = violations.filter((item) => item.rule_id === "mixed-arithmetic-precedence");

		expect({
			count: arithmetic.length,
			typescript: arithmetic.some((item) => item.file.endsWith("nested.ts")),
			python: arithmetic.some((item) => item.file.endsWith("nested.py")),
		}).toEqual({ count: 2, typescript: true, python: true });
	});

	test("checks modulo, floor division, and exponentiation precedence", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"arithmetic.ts": ["const modulo = first + second % third;", "const exponent = first * second ** third;"].join(
				"\n",
			),
			"arithmetic.py": ["modulo = first + second % third", "floor = first // second - third"].join("\n"),
		});
		const arithmetic = violations.filter((item) => item.rule_id === "mixed-arithmetic-precedence");

		expect({
			count: arithmetic.length,
			typescript: arithmetic.filter((item) => item.file.endsWith("arithmetic.ts")).length,
			python: arithmetic.filter((item) => item.file.endsWith("arithmetic.py")).length,
		}).toEqual({ count: 4, typescript: 2, python: 2 });
	});

	test("requires grouping for negation applied to comparisons", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"negation.ts": [
				"const first = !value === expected;",
				"const second = (!value) === expected;",
				"const third = !(value === expected);",
			].join("\n"),
			"negation.py": [
				"first = not value == expected",
				"second = (not value) == expected",
				"third = not (value == expected)",
			].join("\n"),
		});
		const boolean = violations.filter((item) => item.rule_id === "mixed-boolean-precedence");

		expect({
			count: boolean.length,
			typescript: boolean.filter((item) => item.file.endsWith("negation.ts")).length,
			python: boolean.filter((item) => item.file.endsWith("negation.py")).length,
		}).toEqual({ count: 2, typescript: 1, python: 1 });
	});
});
