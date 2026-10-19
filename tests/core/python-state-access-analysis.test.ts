import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python state access analysis", () => {
	test("detects object setattr aliases and direct private member access", () => {
		const fixture = new TestFixture();
		const count = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"object-setattr-alias.py": [
					"set_attr = object.__setattr__",
					"",
					"def update(value):",
					'    set_attr(value, "name", "updated")',
				].join("\n"),
				"object-setattr-receiver-alias.py": [
					"setattr_owner = object",
					"def update(value):",
					'    setattr_owner.__setattr__(value, "name", "updated")',
				].join("\n"),
				"private.py": [
					"class Sample:",
					"    def __init__(self):",
					"        self._secret = 1",
					"    def read(self):",
					"        return self._secret",
					"    def read_other(self, other):",
					"        return other._secret",
					"sample = Sample()",
					"sample._secret",
					"sample.__class__",
				].join("\n"),
				"private-reflection.py": [
					"import builtins as bi",
					"from builtins import getattr as ga",
					"from builtins import setattr as sa",
					"class Sample:",
					"    def __init__(self):",
					"        self._secret = 1",
					"sample = Sample()",
					'getattr(sample, "_secret")',
					'ga(sample, "_secret")',
					'bi.getattr(sample, "_secret")',
					'setattr(sample, "_secret", 2)',
					'sa(sample, "_secret", 3)',
					'sample.__getattribute__("_secret")',
					'sample.__setattr__("_secret", 4)',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			count.filter((item) => item.message === "private class members must not be accessed from outside their class"),
		).toHaveLength(9);
		expect(count.filter((item) => item.message === "avoid direct object.__setattr__ calls")).toHaveLength(2);
	});

	test("detects private access through lexical aliases, dictionaries, and vars mappings", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"private-lexical-alias.py": [
						"class Sample:",
						"    def __init__(self):",
						"        self._secret = 1",
						"def read_secret(sample):",
						'    key = "_secret"',
						"    return getattr(sample, key)",
						"def read_public(sample):",
						'    key = "public"',
						"    return getattr(sample, key)",
					].join("\n"),
					"private-dictionaries.py": [
						"class Sample:",
						"    def __init__(self):",
						"        self._secret = 1",
						"sample = Sample()",
						'sample.__dict__["_secret"]',
						'sample.__dict__["_" + "secret"]',
						'secret_name = "_secret"',
						"sample.__dict__[secret_name]",
						'readers = {"read": getattr}',
						'readers["read"](sample, "_secret")',
					].join("\n"),
					"private-vars.py": [
						"from builtins import vars as object_vars",
						"class Sample:",
						"    def __init__(self):",
						"        self._secret = 1",
						"sample = Sample()",
						'vars(sample)["_secret"]',
						'object_vars(sample)["_secret"]',
						'vars(sample).get("_secret")',
						'object_vars(sample).get("_secret")',
						'vars(sample).pop("_secret")',
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.message === "private class members must not be accessed from outside their class").length;
		expect(count).toBe(10);
	});
});
