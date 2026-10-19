import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("project lint result collection", () => {
	test("returns file-local diagnostics for every discovered source file", () => {
		const fixture = new TestFixture();
		const report = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "const first = a.b.c.d.e;\n",
				"second.ts": "const second = a.b.c.d.e;\n",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);
		expect({
			first: report.report.violations.some((item) => item.file.endsWith("first.ts")),
			second: report.report.violations.some((item) => item.file.endsWith("second.ts")),
			keys: Object.keys(report.report),
		}).toEqual({ first: true, second: true, keys: ["files", "violations"] });
	});

	test("reports parse errors in incomplete Python files without crashing", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "invalid.py": "def broken(\n" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: "parse-error", file: expect.stringMatching(/invalid\.py$/u) }),
		);
	});

	test("uses sibling declarations as analysis context without reporting unselected files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"base.ts": "export class Base {}\n",
				"child.ts": "export class Child extends Base {}\n",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
			["child.ts"],
		);
		expect(violations.report.violations.map((item) => item.file.endsWith("base.ts"))).not.toContain(true);
		expect(violations.report.violations).toContainEqual(
			expect.objectContaining({ message: 'class inherits from local class "Base"' }),
		);
	});
});
