import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

/** Responsibilities: _numeric-name diagnostic reporting_. **/
describe("numeric name lint", () => {
	test("rejects numeric names in TypeScript and Python, including local symbols", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": [
					"type Data2 = string;",
					"class Service2 {",
					"  field2: string;",
					"  method2(parameter2: string): string {",
					"    const local2 = parameter2;",
					"    return local2;",
					"  }",
					"}",
				].join("\n"),
				"source.py": [
					"Data2 = dict[str, str]",
					"class Contract2:",
					"    field3: str",
					"",
					"class Service2:",
					"    field2: str",
					"    def method2(self, parameter2: str) -> str:",
					"        local2 = parameter2",
					"        return local2",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const numeric_violations = violations.filter((violation) => violation.rule_id() === "numeric-name");
		expect({
			typescript: numeric_violations
				.filter((violation) => violation.file() === "source.ts")
				.map((violation) => `${violation.file()}:${violation.line()}`)
				.sort(),
			python: numeric_violations
				.filter((violation) => violation.file() === "source.py")
				.map((violation) => `${violation.file()}:${violation.line()}`)
				.sort(),
			messages_match_rule: numeric_violations.every(
				(violation) => violation.message() === "symbol names must not contain numbers",
			),
		}).toEqual({
			typescript: ["source.ts:1", "source.ts:2", "source.ts:3", "source.ts:4", "source.ts:4", "source.ts:5"],
			python: [
				"source.py:1",
				"source.py:2",
				"source.py:3",
				"source.py:5",
				"source.py:6",
				"source.py:7",
				"source.py:7",
				"source.py:8",
			],
			messages_match_rule: true,
		});
	});

	test("allows numeric values when identifiers contain no digits", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"values.ts": 'const version = "v2";\nconst count = 2;\n',
				"values.py": 'version = "v2"\ncount = 2\n',
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const numeric_name_violations = violations.filter((violation) => violation.rule_id() === "numeric-name");

		expect(numeric_name_violations).toEqual([]);
	});
});
