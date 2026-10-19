import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python-specific coding rules", () => {
	test("rejects object construction in class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"field-construction.py": ["class CacheOwner:", "    values = Map()", "    helper: object = CacheHelper()"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "field-in-constructor")).toHaveLength(2);
	});

	test("allows immutable Final class marker factories", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"marker.py": ["from typing import Final", "class Marker:", "    marker: Final = HookFactory()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "field-in-constructor")).toHaveLength(0);
	});

	test("keeps dataclasses free of logic methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"data-class.py": [
					"from dataclasses import dataclass",
					"",
					"@dataclass",
					"class User:",
					"    name: str",
					"    def __post_init__(self):",
					"        self.name = self.name.strip()",
					"    def normalize(self):",
					"        return self.name.strip()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-data-class-method")).toHaveLength(1);
	});

	test("replaces ABCs with Protocols, including aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"abstract.py": [
					"from abc import ABC, abstractmethod",
					"class Contract(ABC):",
					"    @abstractmethod",
					"    def run(self):",
					"        ...",
					"",
					"from abc import ABC as ContractBase, abstractmethod as required",
					"class AliasContract(ContractBase):",
					"    @required",
					"    def close(self):",
					"        ...",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-abstract-class")).toHaveLength(2);
	});

	test("requires Python test functions to be class methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/free_test.py": [
					"def test_free_function():",
					"    return True",
					"",
					"class TestMethods:",
					"    def test_method(self):",
					"        return True",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages).toContain("python tests must be class methods");
		expect(messages.filter((message) => message === "python tests must be class methods")).toHaveLength(1);
	});

	test("requires Python test classes to inherit from unittest.TestCase", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/pytest_test.py": [
					"import unittest",
					"import pytest",
					"",
					"class FixtureSupport:",
					"    @pytest.fixture",
					"    def test_resource(self):",
					"        return True",
					"",
					"class TestWithoutBase:",
					"    def test_result(self):",
					"        return True",
					"",
					"class TestUnit(unittest.TestCase):",
					"    def test_result(self):",
					"        return True",
					"",
					"class TestWithBase(pytest.ProjectTestBase):",
					"    def test_result(self):",
					"        return True",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-test-class-inheritance")).toHaveLength(2);
	});

	test("limits attribute chains to four levels in Python and TypeScript", () => {
		const fixture = new TestFixture();
		const messages = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "chain.py": "value = a.b.c.d.e\n", "chain.ts": "const value = a.b.c.d.e;\n" },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((item) => item.message);
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "chain.ts": "const value = a.b.c.d.e;\n" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(messages.filter((message) => message === "attribute access is too deep (found 5 levels)")).toHaveLength(2);
		expect(violations.find((item) => item.message === "attribute access is too deep (found 5 levels)")?.hint).toContain(
			"temporary local variables",
		);
	});

	test("does not duplicate TypeScript attribute findings after repeated AST normalization", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "chain.ts": "const value = a.b.c.d.e;\n" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.message === "attribute access is too deep (found 5 levels)")).toHaveLength(
			1,
		);
	});

	test("allows four-level attribute chains", () => {
		const fixture = new TestFixture();
		const messages = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "chain.py": "value = a.b.c.d\n", "chain.ts": "const value = a.b.c.d;\n" },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((item) => item.message);
		expect(messages).not.toContain("attribute access is too deep (found 5 levels)");
	});
});
