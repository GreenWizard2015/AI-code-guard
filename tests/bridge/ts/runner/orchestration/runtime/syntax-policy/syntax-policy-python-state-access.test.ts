import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint syntax policy - Python access", () => {
	const test_fixture = new TestFixture();

	test("rejects Python object setattr aliases", () => {
		const messages = test_fixture.violation_messages({
			"object-setattr-alias.py": [
				"set_attr = object.__setattr__",
				"",
				"def update(value):",
				'    set_attr(value, "name", "updated")',
			].join("\n"),
		});

		expect(messages).toContain("avoid direct object.__setattr__ calls");
	});

	test("rejects Python object setattr aliases through assigned receivers", () => {
		const messages = test_fixture.violation_messages({
			"object-setattr-receiver-alias.py": [
				"setattr_owner = object",
				"def update(value):",
				'    setattr_owner.__setattr__(value, "name", "updated")',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid direct object.__setattr__ calls")).toHaveLength(1);
	});

	test("rejects Python private member access from outside a class", () => {
		const messages = test_fixture.violation_messages({
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
		});

		expect(messages).toContain("private class members must not be accessed from outside their class");
		expect(
			messages.filter((message) => message === "private class members must not be accessed from outside their class"),
		).toHaveLength(2);
	});

	test("rejects Python private member access through reflection", () => {
		const messages = test_fixture.violation_messages({
			"private-bypasses.py": [
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
		});

		expect(
			messages.filter((message) => message === "private class members must not be accessed from outside their class"),
		).toHaveLength(7);
	});

	test("rejects Python private member access through dictionaries", () => {
		const messages = test_fixture.violation_messages({
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
		});

		expect(
			messages.filter((message) => message === "private class members must not be accessed from outside their class"),
		).toHaveLength(4);
	});

	test("rejects Python private member access through vars mappings", () => {
		const messages = test_fixture.violation_messages({
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
		});

		expect(
			messages.filter((message) => message === "private class members must not be accessed from outside their class"),
		).toHaveLength(5);
	});
});
