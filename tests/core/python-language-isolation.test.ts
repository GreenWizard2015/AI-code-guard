import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("project class names remain language-specific", () => {
	test("does not treat a TypeScript base with the same name as a Python project base", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"base.ts": "export class Base {}\n",
				"child.py": ["class Child(Base):", "    def run(self) -> None:", "        return None"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "local-inheritance")).toHaveLength(0);
	});

	test("does not treat a Python base with the same name as a TypeScript project base", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"base.py": "class Base:\n    pass\n",
				"child.ts": "class Child extends Base {}\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "local-inheritance")).toHaveLength(0);
	});
});
