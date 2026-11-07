import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript namespace file rules", () => {
	test("allows imports and one namespace only", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"valid-namespace.ts": [
					"import { value } from './value';",
					"namespace Scope {",
					"\texport const result = value;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-namespace-file")).toHaveLength(0);
	});

	test("rejects multiple namespaces and code outside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"invalid-namespace.ts": ["namespace First {}", "namespace Second {}", "const outside = 1;"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-namespace-file")).toHaveLength(1);
	});

	test("counts nested namespace declarations", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"nested-namespace.ts": ["namespace Outer {", "\texport namespace Inner {}", "}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "typescript-namespace-file").map((item) => item.line()),
		).toEqual([2]);
	});

	test("applies ordinary TypeScript rules inside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"namespace-content.ts": [
					"namespace Scope {",
					"\texport function read(value: unknown): any {",
					"\t\treturn value;",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.rule_id() === "type-info")).toBe(true);
		expect(violations.some((item) => item.rule_id() === "typescript-unknown-parameter-type")).toBe(true);
	});

	test("preserves namespace discovery for malformed nested declarations", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"ordinary.ts": [
					"// namespace appears only as a comment",
					'const label = "module";',
					"function read() { return 1; }",
				].join("\n"),
				"malformed.ts": ["function read() {", "\tnamespace Nested {}", "}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "typescript-namespace-file").map((item) => item.file()),
		).toEqual(["malformed.ts"]);
	});
});
