import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Python __all__ literal-list rule", () => {
	test("allows only direct lists of string literals", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"valid.py": '__all__ = ["PublicService", "PublicContract"]',
				"empty.py": "__all__ = []",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "python-all-list-assignment")).toEqual([]);
	});

	test("reports operations, non-list values, and non-literal list entries", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"augmented.py": '__all__ = ["First"]\n__all__ += ["Second"]',
				"mutated.py": '__all__ = ["First"]\n__all__.append("Second")',
				"computed.py": "__all__ = EXPORTS",
				"combined.py": '__all__ = ["First"] + ["Second"]',
				"annotated.py": '__all__: list[str] = ["First"]',
				"dynamic-item.py": "__all__ = [EXPORT_NAME]",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);
		const violations = execution.report.violations.filter((item) => item.rule_id === "python-all-list-assignment");

		expect(violations.map((item) => item.file.split("/").at(-1))).toEqual([
			"annotated.py",
			"augmented.py",
			"combined.py",
			"computed.py",
			"dynamic-item.py",
			"mutated.py",
		]);
	});
});
