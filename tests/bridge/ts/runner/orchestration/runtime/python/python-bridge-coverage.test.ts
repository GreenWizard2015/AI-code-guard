import "src/bridge/ts/runner/orchestration/runtime/python/python-rule-collector";
import "src/bridge/ts/runner/orchestration/runtime/python/python-ast-file-rule-collector";
import { beforeAll, describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";
import { COVERAGE_CONTROL_FLOW_SOURCE, ACCESS_SOURCE, STRUCTURE_SOURCE } from "tests/core/constants";

describe("Python bridge coverage through TypeScript", () => {
	let violations: ReturnType<TestFixture["collect_fixture_violations"]>;

	beforeAll(() => {
		const fixture = new TestFixture();
		violations = fixture.collect_fixture_violations({
			"coverage-flow.py": COVERAGE_CONTROL_FLOW_SOURCE,
			"coverage-access.py": ACCESS_SOURCE,
			"coverage-structure.py": STRUCTURE_SOURCE,
		});
	});

	test("covers Python control flow and annotation branches", () => {
		expect({
			conditional: violations.some((item) => item.rule_id === "conditional-execution"),
			ternary: violations.some((item) => item.rule_id === "ternary-expression"),
			undefined: violations.some((item) => item.rule_id === "unnecessary-undefined-check"),
			union: violations.some((item) => item.rule_id === "composite-state-type"),
			walrus: violations.some((item) => item.rule_id === "python-walrus"),
		}).toEqual({ conditional: true, ternary: true, undefined: true, union: true, walrus: true });
	});

	test("covers Python private access and proxy callable branches", () => {
		expect({
			private_access: violations.some((item) => item.rule_id === "private-member"),
			proxy_callable: violations.some((item) => item.rule_id === "proxy-callable"),
			proxy_lambda: violations.some((item) => item.rule_id === "proxy-lambda"),
		}).toEqual({ private_access: true, proxy_callable: true, proxy_lambda: true });
	});

	test("covers Python constructor, class metadata, and precedence branches", () => {
		expect({
			constructor: violations.some((item) => item.rule_id === "complex-constructor"),
			boolean_precedence: violations.some((item) => item.rule_id === "mixed-boolean-precedence"),
			arithmetic_precedence: violations.some((item) => item.rule_id === "mixed-arithmetic-precedence"),
			single_array: violations.some((item) => item.rule_id === "single-item-array-state"),
		}).toEqual({ constructor: true, boolean_precedence: true, arithmetic_precedence: true, single_array: true });
	});
});
