import { describe, expect, test } from "@jest/globals";
import { LintFileName } from "src/core/context/lint_file_name";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import { NULLABLE_DOMAIN_FILES } from "tests/core/constants/callable_usage/constants";
import { TestFixture } from "tests/core/test-fixture";

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
		const messages = violations.map((item) => item.message());
		expect(messages).toContain("avoid overly broad unions");
		expect(messages).toContain("use Optional[T] instead of T | None");
	});

	test("recommends specialized state classes for nullable domain types", () => {
		const test_fixture = new TestFixture();
		const files = {
			...NULLABLE_DOMAIN_FILES,
			"optional.ts": 'type Input = { readonly value?: string; };\nfunction load(input?: string): string { return ""; }',
			"nullish-fields.py": ["class NullableFields:", "    missing: None", "    impossible: Never"].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const nullable_locations = violations
			.filter((item) => item.message() === "replace nullable types with specialized state classes")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
		expect(nullable_locations).toEqual([
			"nullable.py:6",
			"nullable.py:7",
			"nullable.py:8",
			"nullable.py:9",
			"nullable.py:11",
			"nullable.ts:3",
			"nullable.ts:4",
			"nullable.ts:5",
			"nullable.ts:6",
			"nullish-fields.py:2",
			"nullish-fields.py:3",
			"optional.ts:1",
			"optional.ts:2",
		]);
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
		const messages = violations.map((item) => item.message());
		expect(
			messages.filter((message) => message.startsWith('multiple methods share parameter set "body:JsonValue"')),
		).toEqual(
			expect.arrayContaining([expect.stringContaining('multiple methods share parameter set "body:JsonValue"')]),
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
			"indexed-type-factory.py": [
				"from typing import NamedTuple",
				"factory = tuple([NamedTuple])[0]",
				'record = factory("Record", [])',
			].join("\n"),
			"wrapped-type-factories.py": [
				'type("CandidateIf", (), {}) if enabled else None',
				'enabled and type("CandidateAnd", (), {})',
				'(lambda: type("CandidateLambda", (), {}))()',
				"def create():",
				'    yield type("CandidateYield", (), {})',
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), test_fixture.file_io()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const dynamic_factory_locations = violations
			.filter((item) => item.message() === "avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
		const dynamic_class_locations = violations
			.filter((item) => item.message() === "avoid dynamic class construction with type(...)")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
		expect({ dynamic_factory_locations, dynamic_class_locations }).toEqual({
			dynamic_factory_locations: [
				"indexed-type-factory.py:3",
				"namedtuple.py:2",
				"namedtuple.py:3",
				"namedtuple.py:5",
				"namedtuple.py:6",
				"namedtuple.py:8",
				"namedtuple.py:9",
				"namedtuple.py:10",
			],
			dynamic_class_locations: [
				"wrapped-type-factories.py:1",
				"wrapped-type-factories.py:2",
				"wrapped-type-factories.py:3",
				"wrapped-type-factories.py:5",
			],
		});
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

		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "child.py",
			rule_id: "local-inheritance",
		});
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

		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "child.py",
			rule_id: "local-inheritance",
		});
	});

	test("keeps a concrete Python boundary forbidden despite a same-named protocol", () => {
		const test_fixture = new TestFixture();
		const python_ast_data = new PythonAstData({
			worker: test_fixture.worker(),
			analysis_identity: new ProjectAnalysisIdentity(test_fixture.file_io()),
			split_batch_enabled: false,
			file_io: test_fixture.file_io(),
			cache_enabled: false,
		});
		const source = ["def consume(value: Item) -> str:", "    return value.value()"].join("\n");
		const ast = python_ast_data.source_ast(source);
		const scanner = new PythonScanner("", [], new LintStageTimer());
		const violations = scanner.lint_python_file(
			{
				file_name: new LintFileName("consumer.py"),
				source_file: "consumer.py",
				text: source,
				project_class_names: new Set(["Item"]),
				python_class_names: new Set(["Item"]),
				project_protocol_names: new Set(["Item"]),
				project_type_names: new Set<string>(),
				project_alias_names: new Set<string>(),
				normalized_ast: ast,
			},
			new LintStageTimer(),
		);

		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "consumer.py",
			rule_id: "project-type-boundary",
		});
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

		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id() }))).toContainEqual({
			file: "adapter.py",
			rule_id: "class-interface-count",
		});
	});
});
