import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Python project entry-point usages", () => {
	test("counts only the Python class registered in project metadata", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"pyproject.toml": [
					'[project.entry-points."example.plugins"]',
					'sample = "webmcp_project.plugin:SamplePlugin"',
				].join("\n"),
				"tools/webmcp_project/plugin.py": [
					"class SamplePlugin:",
					"    pass",
					"",
					"class UnusedPlugin:",
					"    pass",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id === "unused-class").map((item) => `${item.file}:${item.message}`),
		).toEqual(['tools/webmcp_project/plugin.py:class "UnusedPlugin" has no production usage']);
	});

	test("resolves entry points exported by a Python package", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"pyproject.toml": [
					'[project.entry-points."example.plugins"]',
					'sample = "webmcp_project.plugin:SamplePlugin"',
				].join("\n"),
				"tools/webmcp_project/plugin/__init__.py": "class SamplePlugin:\n    pass",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-class")).toEqual([]);
	});

	test("does not treat unrelated project metadata as an entry point", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"pyproject.toml": ["[tool.example.plugins]", 'sample = "webmcp_project.plugin:SamplePlugin"'].join("\n"),
				"tools/webmcp_project/plugin.py": "class SamplePlugin:\n    pass",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-class")).toHaveLength(1);
	});
});
