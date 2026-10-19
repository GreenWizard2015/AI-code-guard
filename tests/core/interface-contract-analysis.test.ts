import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { CONSTRUCTOR_FILES, MIXED_DEPENDENCY_FILES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("interface and constructor contracts", () => {
	test("keeps method contracts and mixed dependencies valid while rejecting index signatures", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				...MIXED_DEPENDENCY_FILES,
				"method-only.ts": "interface ChatThreadLoader { fetch_threads(pattern: string): Promise<ThreadList>; }",
				"index-signature.ts": "type RuntimeRecord = { [key: string]: string };",
				"options.ts": [
					"type Options = {",
					"  enabled: boolean;",
					"  on_start?: () => void;",
					"  on_complete?: () => void;",
					"  on_failure?: () => void;",
					"  on_error?: () => void;",
					"};",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages).not.toContain("use an interface instead of a callable-heavy type alias or object shape");
		expect(violations.filter((item) => item.rule_id === "typescript-index-signature")).toHaveLength(1);
	});

	test("limits constructors to setup and validation in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			CONSTRUCTOR_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations.filter((item) => item.message === "keep constructors limited to setup and validation"),
		).toHaveLength(2);
	});
});
