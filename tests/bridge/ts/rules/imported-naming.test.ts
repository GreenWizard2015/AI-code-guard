import "src/bridge/ts/rules/class-rules";
import "src/bridge/ts/rules/naming-validation";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint imported naming rules", () => {
	test("rejects leading underscores on imported local names", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"source.ts": ['import { value as _value } from "source";', 'import * as _namespace from "source";'].join("\n"),
		});

		expect(violations.filter((violation) => violation.rule_id === "naming-private")).toHaveLength(2);
	});

	test("rejects leading underscore on a default import", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"source.ts": 'import _default_value from "source";\n',
		});

		expect(violations.filter((violation) => violation.rule_id === "naming-private")).toHaveLength(1);
	});
});
