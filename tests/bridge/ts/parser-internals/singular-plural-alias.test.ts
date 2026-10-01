import "src/bridge/ts/parser-internals/typescript-node-rules";
import "src/bridge/ts/parser-internals/typescript-structural-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("singular plural alias rule", () => {
	test("reports direct aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"interface-alias.ts": "type Control = { item?: string; items?: string[]; };",
		});

		expect(violations.filter((item) => item.rule_id === "typescript-singular-plural-alias")).toHaveLength(2);
	});

	test("reports aliases inherited through interfaces", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"interface-alias.ts": [
				"interface SingularPart { item?: string; }",
				"interface PluralPart { items?: string[]; }",
				"interface Candidate extends SingularPart, PluralPart {",
				"\tvalidate(): boolean;",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-singular-plural-alias")).toHaveLength(1);
	});

	test("reports aliases through multiple interface levels", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"interface-alias.ts": [
				"interface ItemPart { item?: string; }",
				"interface SingularPart extends ItemPart {}",
				"interface PluralPart { items?: string[]; }",
				"interface Candidate extends SingularPart, PluralPart { validate(): boolean; }",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-singular-plural-alias")).toHaveLength(1);
	});
});
