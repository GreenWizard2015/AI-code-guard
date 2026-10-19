import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("public state exposure", () => {
	test("reports externally mutable collection fields in TypeScript and Python", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"registry.ts": "class Registry { public items: Map<string, Item>; }",
				"registry.py":
					"class Registry:\n    items: dict[str, Item]\n\n    def read(self) -> None:\n        return None",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "public-state-exposure").map((item) => item.file)).toEqual([
			"registry.py",
			"registry.ts",
		]);
	});

	test("allows owned mutable fields and immutable contract views", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"registry.ts": [
					"interface RegistryContract { items: Map<string, Item>; }",
					"class Registry {",
					"  private items: Map<string, Item>;",
					"  protected values: Set<Item>;",
					"  public readonly snapshot: Map<string, Item>;",
					"}",
				].join("\n"),
				"registry.py": [
					"from typing import Protocol",
					"class RegistryContract(Protocol):",
					"    items: dict[str, Item]",
					"class Registry:",
					"    _items: dict[str, Item]",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "public-state-exposure")).toHaveLength(0);
	});
});
