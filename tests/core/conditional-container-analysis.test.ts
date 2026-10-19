import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional expression containers", () => {
	test("reports logical execution inside arrays, objects, spreads, and call inputs", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-conditional.ts": "const [candidate] = [ready && load()];",
				"object-conditional.ts": "const { candidate } = { candidate: ready && load() };",
				"nested-conditional.ts": "const { candidate } = { candidate: [ready && load()] };",
				"spread-conditional.ts": "const { candidate } = { ...{ candidate: ready && load() } };",
				"call-conditional.ts": "const candidate = identity(ready && load());",
				"element-conditional.ts": "const candidate = values[ready && load()];",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.message === "avoid conditional execution operators");
		expect(findings.map((item) => item.file)).toEqual([
			"array-conditional.ts",
			"call-conditional.ts",
			"element-conditional.ts",
			"nested-conditional.ts",
			"object-conditional.ts",
			"spread-conditional.ts",
		]);
	});

	test("reports parenthesized, asserted, and interpolated conditional expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"parenthesized-conditional.ts": "const [candidate] = [(ready && load())];",
				"non-null-conditional.ts": "const candidate = (ready && load())!;",
				"non-null-call-conditional.ts": "report((ready && load())!);",
				"satisfies-conditional.ts": "const candidate = (ready && load()) satisfies string | false;",
				"template-conditional.ts": "const candidate = `${ready && load()}`;",
				"tagged-template-conditional.ts": "const candidate = String.raw`${ready && load()}`;",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.message === "avoid conditional execution operators");
		expect(findings).toHaveLength(6);
	});
});
