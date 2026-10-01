import "src/bridge/ts/parser-internals/typescript-node-rules";
import "src/bridge/ts/parser-internals/typescript-structural-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript type alias rules", () => {
	test("reports top-level bare aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"aliases.ts": ["type ExistingShape = { value: string };", "type CandidateAlias = ExistingShape;"].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-bare-type-alias")).toHaveLength(1);
	});

	test("reports bare aliases nested in namespaces", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"namespace-aliases.ts": [
				"type ExistingShape = { value: string };",
				"namespace TypeScope {",
				"  export type CandidateAlias = ExistingShape;",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-bare-type-alias")).toHaveLength(1);
	});

	test("reports bare aliases in nested namespace chains", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"nested-namespace-aliases.ts": [
				"type ExistingShape = { value: string };",
				"namespace TypeScope {",
				"  export namespace Nested {",
				"    export type CandidateAlias = ExistingShape;",
				"  }",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-bare-type-alias")).toHaveLength(1);
	});
});
