import "src/bridge/ts/runner/orchestration/runtime/python/python-rule-collector";
import "src/bridge/ts/runner/orchestration/runtime/python/python-ast-file-rule-collector";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

import { NULLABLE_DOMAIN_FILES } from "tests/core/constants";

describe("coding-lint Python-specific rules", () => {
	test("keeps dataclasses free of logic methods", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect(violations.filter((item) => item.rule_id === "python-data-class-method")).toHaveLength(1);
	});

	test("replaces ABCs with Protocols, including aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect(violations.filter((item) => item.rule_id === "python-abstract-class")).toHaveLength(2);
	});

	test("requires Python test functions to be class methods", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"tests/free_test.py": [
				"def test_free_function():",
				"    return True",
				"",
				"class TestMethods:",
				"    def test_method(self):",
				"        return True",
			].join("\n"),
		});

		expect(messages).toContain("python tests must be class methods");
		expect(messages.filter((message) => message === "python tests must be class methods")).toHaveLength(1);
	});

	test("requires Python test classes to inherit from unittest.TestCase", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
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
		});

		expect(violations.filter((item) => item.rule_id === "python-test-class-inheritance")).toHaveLength(2);
	});

	test("limits attribute chains to four levels in Python and TypeScript", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"chain.py": "value = a.b.c.d.e\n",
			"chain.ts": "const value = a.b.c.d.e;\n",
		});
		const violations = test_fixture.collect_fixture_violations({
			"chain.ts": "const value = a.b.c.d.e;\n",
		});

		expect(messages.filter((message) => message === "attribute access is too deep (found 5 levels)")).toHaveLength(2);
		expect(violations.find((item) => item.message === "attribute access is too deep (found 5 levels)")?.hint).toContain(
			"temporary local variables",
		);
	});

	test("does not duplicate TypeScript attribute findings after repeated AST normalization", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"chain.ts": "const value = a.b.c.d.e;\n",
		});

		expect(violations.filter((item) => item.message === "attribute access is too deep (found 5 levels)")).toHaveLength(
			1,
		);
	});

	test("allows four-level attribute chains", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"chain.py": "value = a.b.c.d\n",
			"chain.ts": "const value = a.b.c.d;\n",
		});

		expect(messages).not.toContain("attribute access is too deep (found 5 levels)");
	});

	test("rejects large unions and recommends Optional for nullable annotations", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"unions.py": [
				"from typing import Optional",
				"Alias = int | str | float | bytes",
				"def load(value: str | None) -> Alias:",
				"    return value",
				"def nested(value: list[int | str | float | bytes]):",
				"    return value",
			].join("\n"),
			"unions.ts": ["type Alias = string | number | boolean | null;"].join("\n"),
		});

		expect(messages).toContain("avoid overly broad unions");
		expect(messages).toContain("use Optional[T] instead of T | None");
	});

	test("recommends specialized state classes for nullable domain types", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			...NULLABLE_DOMAIN_FILES,
			"optional.ts": 'type Input = { readonly value?: string; };\nfunction load(input?: string): string { return ""; }',
		});

		expect(
			messages.filter((message) => message === "replace nullable types with specialized state classes"),
		).toHaveLength(11);
	});

	test("rejects Python fields typed only as nullish values", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"nullish-fields.py": ["class NullableFields:", "    missing: None", "    impossible: Never"].join("\n"),
		});

		expect(
			messages.filter((message) => message === "replace nullable types with specialized state classes"),
		).toHaveLength(2);
	});

	test("reports shared named parameters when each method uses them once", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"dispatcher.py": [
				"class JsonValue: pass",
				"",
				"class Dispatcher:",
				"    def register(self, body: JsonValue):",
				"        return body",
				"    def unregister(self, body: JsonValue):",
				"        return body",
				"    def result(self, body: JsonValue):",
				"        return body",
				"    def dispatch(self, body: JsonValue):",
				"        return body",
			].join("\n"),
		});

		expect(messages.some((message) => message.startsWith('multiple methods share parameter type "JsonValue"'))).toBe(
			true,
		);
	});

	test("rejects dynamic type factory construction", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"namedtuple.py": [
				"from collections import namedtuple",
				'request = namedtuple("Request", ["path"])',
				'response = collections.namedtuple("Response", ["body"])',
				"from typing import NamedTuple, TypedDict, NewType",
				'Response = NamedTuple("Response", [])',
				'Fields = TypedDict("Fields", {})',
				"Factory = TypedDict",
				'Assigned = Factory("Assigned", {})',
				'UserId = NewType("UserId", int)',
				"class Record(TypedDict):",
				"    value: str",
			].join("\n"),
		});

		expect(
			messages.filter(
				(message) => message === "avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)",
			),
		).toHaveLength(7);
	});

	test("resolves type factories through indexed tuple values", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"indexed-type-factory.py": [
				"from typing import NamedTuple",
				"factory = tuple([NamedTuple])[0]",
				'record = factory("Record", [])',
			].join("\n"),
		});

		expect(messages).toContain("avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)");
	});

	test("rejects dynamic type factories inside expression wrappers", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"wrapped-type-factories.py": [
				'candidate_if = type("CandidateIf", (), {}) if enabled else None',
				'candidate_and = enabled and type("CandidateAnd", (), {})',
				'candidate_lambda = (lambda: type("CandidateLambda", (), {}))()',
				"def create():",
				'    candidate_yield = yield type("CandidateYield", (), {})',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid dynamic class construction with type(...)")).toHaveLength(4);
	});
});
