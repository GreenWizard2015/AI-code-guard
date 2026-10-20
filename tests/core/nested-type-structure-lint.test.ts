import { TestFixture } from "tests/core/test-fixture";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint nested type declarations", () => {
	test("rejects aliases, interfaces, and enums in every nested scope", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-types.ts": [
					"namespace Scope {",
					"\texport type NestedAlias = string;",
					"\texport interface NestedInterface { run(): void; }",
					"\texport enum NestedEnum { Ready }",
					"}",
					"function create(): string {",
					"\ttype FunctionAlias = string;",
					'\treturn "value";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "nested-type")).toEqual([
			expect.objectContaining({ priority: 8 }),
		]);
	});

	test("gives nested type violations higher priority than type checks", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-type-priority.ts": [
					"function create(): unknown {",
					"\ttype LocalValue = any;",
					"\treturn {};",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const nested = violations.find((item) => item.rule_id === "nested-type");
		const unbounded = violations.find((item) => item.rule_id === "unbounded-type");

		expect(nested?.priority).toBe(8);
		expect(unbounded?.priority).toBe(5);
	});

	test("rejects nested Python type aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-types.py": [
					"from typing import TypeAlias",
					"",
					"def create():",
					"    LocalValue: TypeAlias = str",
					'    return "value"',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "nested-type")).toEqual([
			expect.objectContaining({ priority: 8 }),
		]);
	});

	test("does not treat a module constant used inside a method as a nested type alias", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"config.py": 'WARM_MODE = "warm"',
				"snapshot.py": [
					"from config import WARM_MODE",
					"class Snapshot:",
					"    def mode(self) -> str:",
					"        mode = WARM_MODE",
					"        return mode",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "nested-type")).toEqual([]);
	});
});
