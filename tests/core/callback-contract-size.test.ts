import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("callback contract size", () => {
	test("reports oversized named callback contracts in TypeScript and Python", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"callbacks.ts": "type MemberChanged = (owner: Owner, name: string, before: Value, after: Value) => void;",
					"callbacks.py": [
						"from typing import Callable",
						"def subscribe(callback: Callable[[Owner, str, Value, Metadata], None]) -> None:",
						"    return None",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "callback-contract-size");

		expect(violations).toHaveLength(2);
	});

	test("allows callback contracts with three parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"callbacks.ts": "type MemberChanged = (owner: Owner, name: string, value: Value) => void;",
					"callbacks.py": [
						"from typing import Callable",
						"def subscribe(callback: Callable[[Owner, str, Value], None]) -> None:",
						"    return None",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "callback-contract-size");

		expect(violations).toHaveLength(0);
	});
});
