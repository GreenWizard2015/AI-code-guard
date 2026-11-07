import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("callable body boundaries", () => {
	test("keeps callable parameters outside the callable body boundary", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"callable.ts": [
					"function read(value: unknown): unknown {",
					"  const nested: unknown = value;",
					"  return nested;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode).report,
		);
		const unbounded = execution.violations.filter((item) => item.rule_id() === "unbounded-type");

		expect(unbounded).toHaveLength(2);
		expect(unbounded.filter((item) => item.line() === 2)).toHaveLength(0);
	});

	test("keeps expression-bodied callable values inside the body boundary", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"expression-body.ts": "const read = (value: unknown): unknown => value as unknown;",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode).report,
		);
		const unbounded = execution.violations.filter((item) => item.rule_id() === "unbounded-type");

		expect(unbounded).toHaveLength(2);
		expect(unbounded.every((item) => item.line() === 1)).toBe(true);
	});
});
