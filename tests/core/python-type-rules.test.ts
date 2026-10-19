import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";
import { NULLABLE_DOMAIN_FILES } from "tests/core/constants";
import { PythonAstData } from "src/core/python_ast_data";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { LintFileName } from "src/core/context/lint_file_name";
import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";

describe("coding-lint Python type rules", () => {
	test("rejects large unions and recommends Optional for nullable annotations", () => {
		const test_fixture = new TestFixture();
		const files = {
			"unions.py": [
				"from typing import Optional",
				"Alias = int | str | float | bytes",
				"def load(value: str | None) -> Alias:",
				"    return value",
				"def nested(value: list[int | str | float | bytes]):",
				"    return value",
			].join("\n"),
			"unions.ts": ["type Alias = string | number | boolean | null;"].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages).toContain("avoid overly broad unions");
		expect(messages).toContain("use Optional[T] instead of T | None");
	});

	test("recommends specialized state classes for nullable domain types", () => {
		const test_fixture = new TestFixture();
		const files = {
			...NULLABLE_DOMAIN_FILES,
			"optional.ts": 'type Input = { readonly value?: string; };\nfunction load(input?: string): string { return ""; }',
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(
			messages.filter((message) => message === "replace nullable types with specialized state classes"),
		).toHaveLength(11);
	});

	test("rejects Python fields typed only as nullish values", () => {
		const test_fixture = new TestFixture();
		const files = {
			"nullish-fields.py": ["class NullableFields:", "    missing: None", "    impossible: Never"].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(
			messages.filter((message) => message === "replace nullable types with specialized state classes"),
		).toHaveLength(2);
	});

	test("reports shared named parameters when each method uses them once", () => {
		const test_fixture = new TestFixture();
		const files = {
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
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages.some((message) => message.startsWith('multiple methods share parameter type "JsonValue"'))).toBe(
			true,
		);
	});

	test("rejects dynamic type factory construction", () => {
		const test_fixture = new TestFixture();
		const files = {
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
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(
			messages.filter(
				(message) => message === "avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)",
			),
		).toHaveLength(7);
	});

	test("does not reuse project-specific Python class metadata from cached ASTs", () => {
		const test_fixture = new TestFixture();
		const python_ast_data = new PythonAstData({
			worker: test_fixture.worker(),
			analysis_identity: new ProjectAnalysisIdentity(test_fixture.file_io()),
			split_batch_enabled: false,
			file_io: test_fixture.file_io(),
		});
		const source = ["class Implementation(Base):", "    pass"].join("\n");
		const cached_ast = python_ast_data.source_ast(source);
		const scanner = new PythonScanner();
		const input = {
			file_name: new LintFileName("implementation.py"),
			source_file: "implementation.py",
			text: source,
			project_class_names: new Set(["Base"]),
			python_class_names: new Set(["Base"]),
			project_protocol_names: new Set(["Base"]),
			project_type_names: new Set<string>(),
			normalized_ast: cached_ast,
		};
		scanner.lint_python_file(input);
		const first_interfaces = cached_ast.classes[0].interfaces;
		scanner.lint_python_file({ ...input, project_protocol_names: new Set<string>() });
		expect([first_interfaces, cached_ast.classes[0].interfaces]).toEqual([[], []]);
	});

	test("resolves Python aliased bases by declaration file", () => {
		const test_fixture = new TestFixture();
		const files = {
			"base.py": "class Base:\n    pass\n",
			"child.py": ["from base import Base as RenamedBase", "class Child(RenamedBase):", "    pass"].join("\n"),
			"unrelated.py": "class RenamedBase:\n    pass\n",
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(expect.objectContaining({ file: "child.py", rule_id: "local-inheritance" }));
	});

	test("resolves Python bases re-exported from a package facade", () => {
		const test_fixture = new TestFixture();
		const files = {
			"pkg/base.py": "class Base:\n    pass\n",
			"pkg/__init__.py": "from .base import Base\n",
			"child.py": ["from pkg import Base", "class Child(Base):", "    pass"].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(expect.objectContaining({ file: "child.py", rule_id: "local-inheritance" }));
	});

	test("keeps a concrete Python boundary forbidden despite a same-named protocol", () => {
		const test_fixture = new TestFixture();
		const python_ast_data = new PythonAstData({
			worker: test_fixture.worker(),
			analysis_identity: new ProjectAnalysisIdentity(test_fixture.file_io()),
			split_batch_enabled: false,
			file_io: test_fixture.file_io(),
		});
		const source = ["def consume(value: Item) -> str:", "    return value.value()"].join("\n");
		const ast = python_ast_data.source_ast(source);
		const scanner = new PythonScanner();
		const violations = scanner.lint_python_file({
			file_name: new LintFileName("consumer.py"),
			source_file: "consumer.py",
			text: source,
			project_class_names: new Set(["Item"]),
			python_class_names: new Set(["Item"]),
			project_protocol_names: new Set(["Item"]),
			project_type_names: new Set<string>(),
			normalized_ast: ast,
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ file: "consumer.py", rule_id: "project-type-boundary" }),
		);
	});

	test("recognizes imported aliased Python protocols in class ownership", () => {
		const test_fixture = new TestFixture();
		const files = {
			"ports.py": [
				"from typing import Protocol",
				"class PortA(Protocol):",
				"    def a(self) -> None: ...",
				"class PortB(Protocol):",
				"    def b(self) -> None: ...",
				"class PortC(Protocol):",
				"    def c(self) -> None: ...",
				"class PortD(Protocol):",
				"    def d(self) -> None: ...",
			].join("\n"),
			"adapter.py": [
				"from ports import PortA as A, PortB as B, PortC as C, PortD as D",
				"class Adapter(A, B, C, D):",
				"    pass",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({ file: "adapter.py", rule_id: "class-interface-count" }),
		);
	});

	test("resolves type factories through indexed tuple values", () => {
		const test_fixture = new TestFixture();
		const files = {
			"indexed-type-factory.py": [
				"from typing import NamedTuple",
				"factory = tuple([NamedTuple])[0]",
				'record = factory("Record", [])',
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages).toContain("avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)");
	});

	test("rejects dynamic type factories inside expression wrappers", () => {
		const test_fixture = new TestFixture();
		const files = {
			"wrapped-type-factories.py": [
				'candidate_if = type("CandidateIf", (), {}) if enabled else None',
				'candidate_and = enabled and type("CandidateAnd", (), {})',
				'candidate_lambda = (lambda: type("CandidateLambda", (), {}))()',
				"def create():",
				'    candidate_yield = yield type("CandidateYield", (), {})',
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages.filter((message) => message === "avoid dynamic class construction with type(...)")).toHaveLength(4);
	});
});
