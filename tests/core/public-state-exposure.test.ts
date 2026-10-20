import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("public state exposure", () => {
	test("reports public fields typed with aliased mutable collections", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"registry.py": [
					"from collections import UserList as EntryList",
					"class Registry:",
					"    entries: EntryList[str]",
					"    def __init__(self, entries: EntryList[str]) -> None:",
					"        self.entries = entries",
					"    def entry_count(self) -> int:",
					"        return len(self.entries)",
					"    def contains_entry(self, candidate: str) -> bool:",
					"        return candidate in self.entries",
				].join("\n"),
				"qualified_registry.py": [
					"import collections",
					"class QualifiedRegistry:",
					"    entries: collections.UserList[str]",
					"    def __init__(self, entries: collections.UserList[str]) -> None:",
					"        self.entries = entries",
					"    def entry_count(self) -> int:",
					"        return len(self.entries)",
					"    def contains_entry(self, candidate: str) -> bool:",
					"        return candidate in self.entries",
				].join("\n"),
				"sequence_registry.py": [
					"from typing import MutableSequence as EntrySequence",
					"class SequenceRegistry:",
					"    entries: EntrySequence[str]",
					"    def __init__(self, entries: EntrySequence[str]) -> None:",
					"        self.entries = entries",
					"    def entry_count(self) -> int:",
					"        return len(self.entries)",
					"    def contains_entry(self, candidate: str) -> bool:",
					"        return candidate in self.entries",
				].join("\n"),
				"typed_registry.py": [
					"from collections import UserList",
					"from typing import TypeAlias",
					"EntryList: TypeAlias = UserList[str]",
					"class TypedRegistry:",
					"    entries: EntryList",
					"    def __init__(self, entries: EntryList) -> None:",
					"        self.entries = entries",
					"    def entry_count(self) -> int:",
					"        return len(self.entries)",
					"    def contains_entry(self, candidate: str) -> bool:",
					"        return candidate in self.entries",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "public-state-exposure").map((item) => item.file)).toEqual([
			"qualified_registry.py",
			"registry.py",
			"sequence_registry.py",
			"typed_registry.py",
		]);
	});

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
