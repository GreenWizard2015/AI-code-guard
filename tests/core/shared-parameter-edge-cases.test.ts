import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter lint integration", () => {
	test("includes already named parameter contract types in both languages", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"named-contract.ts": [
					"interface TypeScriptContextContract { readonly name: string; }",
					"class TypeScriptService {",
					"  first(ts_context: TypeScriptContextContract) { return ts_context.name; }",
					"  second(ts_context: TypeScriptContextContract) { return ts_context.name; }",
					"  third(ts_context: TypeScriptContextContract) { return ts_context.name; }",
					"}",
				].join("\n"),
				"named_contract.py": [
					"from typing import Protocol",
					"class PythonContextContract(Protocol):",
					"    name: str",
					"class PythonService:",
					"    def first(self, python_context: PythonContextContract) -> str:",
					"        return python_context.name",
					"    def second(self, python_context: PythonContextContract) -> str:",
					"        return python_context.name",
					"    def third(self, python_context: PythonContextContract) -> str:",
					"        return python_context.name",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		const typescript_shared = shared.filter((violation) => violation.file() === "named-contract.ts");
		const python_shared = shared.filter((violation) => violation.file() === "named_contract.py");
		expect({
			typescript: typescript_shared.map((violation) => `${violation.file()}: ${violation.message()}`),
			python: python_shared.map((violation) => `${violation.file()}: ${violation.message()}`),
		}).toEqual({
			typescript: [
				expect.stringContaining('multiple methods share parameter set "ts_context:TypeScriptContextContract"'),
			],
			python: [expect.stringContaining('multiple methods share parameter set "python_context:PythonContextContract"')],
		});
	});

	test("includes unconstrained TypeScript template parameters", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"template.ts": [
					"class Service<T> {",
					"  first(value: T) { return value; }",
					"  second(value: T) { return value; }",
					"  third(value: T) { return value; }",
					"  fourth(value: T) { return value; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		expect(shared.map((violation) => `${violation.file()}: ${violation.message()}`)).toEqual([
			expect.stringContaining('template.ts: multiple methods share parameter set "value:T"'),
		]);
	});

	test("supports Python AST collections and generic reference annotations", () => {
		const test_fixture = new TestFixture();

		const methods = Array.from(
			{ length: 4 },
			(_, index) => `    def method_${index}(self, values: list[Result]):\n        return values`,
		);
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"ast_collection.py": [
					"import ast",
					"class AstOperations:",
					"    def collect(self, arguments: list[ast.arg]) -> int:",
					"        return len(arguments)",
					"    def filter(self, arguments: list[ast.arg]) -> int:",
					"        return len(arguments)",
					"    def count(self, arguments: list[ast.arg]) -> int:",
					"        return len(arguments)",
				].join("\n"),
				"generic.py": ["class Result:", "    pass", "", "class Service:", methods.join("\n")].join("\n"),
				"mapping_protocol.py": [
					"from collections.abc import MutableMapping",
					"import ast",
					"",
					"class BindingOverlay(MutableMapping[str, ast.AST]):",
					"    def __getitem__(self, name: str) -> ast.AST:",
					"        raise KeyError(name)",
					"    def __setitem__(self, name: str, value: ast.AST) -> None:",
					"        return None",
					"    def __delitem__(self, name: str) -> None:",
					"        raise KeyError(name)",
					"    def __iter__(self):",
					"        return iter(())",
					"    def __len__(self) -> int:",
					"        return 0",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		const ast_collection_shared = shared.filter((violation) => violation.file() === "ast_collection.py");
		const generic_shared = shared.filter((violation) => violation.file() === "generic.py");
		const mapping_shared = shared.filter((violation) => violation.file() === "mapping_protocol.py");
		expect({
			ast_collection: ast_collection_shared.map((violation) => `${violation.file()}: ${violation.message()}`),
			generic: generic_shared.map((violation) => `${violation.file()}: ${violation.message()}`),
			mapping_protocol: mapping_shared.map((violation) => `${violation.file()}: ${violation.message()}`),
		}).toEqual({
			ast_collection: [
				expect.stringContaining('ast_collection.py: multiple methods share parameter set "arguments:list[ast.arg]"'),
			],
			generic: [expect.stringContaining('generic.py: multiple methods share parameter set "values:list[Result]"')],
			mapping_protocol: [],
		});
	});

	test("includes special methods in mixed and special-only shared groups", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"special_method.py": [
					"class MixedInput:",
					"    pass",
					"",
					"class MixedService:",
					"    def __eq__(self, value: MixedInput) -> bool:",
					"        return bool(value)",
					"    def accepts(self, value: MixedInput) -> bool:",
					"        return bool(value)",
					"    def stores(self, value: MixedInput) -> bool:",
					"        return bool(value)",
					"    def forwards(self, value: MixedInput) -> bool:",
					"        return bool(value)",
					"",
				].join("\n"),
				"special_methods.py": [
					"class SpecialOnlyInput:",
					"    pass",
					"",
					"class SpecialOnlyService:",
					"    def __eq__(self, value: SpecialOnlyInput) -> bool:",
					"        return bool(value)",
					"    def __ne__(self, value: SpecialOnlyInput) -> bool:",
					"        return bool(value)",
					"    def __lt__(self, value: SpecialOnlyInput) -> bool:",
					"        return bool(value)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);
		const mixed_special_methods = shared.filter((violation) => violation.file() === "special_method.py");
		const special_only_methods = shared.filter((violation) => violation.file() === "special_methods.py");
		const special_only_messages = special_only_methods.map((violation) => violation.message()).join("\n");
		expect({
			mixed_method_messages: mixed_special_methods.map((violation) => violation.message()),
			special_only: {
				messages: special_only_methods.map((violation) => violation.message()),
				equality: special_only_messages.includes("SpecialOnlyService.__eq__"),
				inequality: special_only_messages.includes("SpecialOnlyService.__ne__"),
				ordering: special_only_messages.includes("SpecialOnlyService.__lt__"),
			},
		}).toEqual({
			mixed_method_messages: [expect.stringContaining("MixedService.__eq__")],
			special_only: {
				messages: [expect.stringContaining("SpecialOnlyService.__eq__")],
				equality: true,
				inequality: true,
				ordering: true,
			},
		});
	});

	test("reports independent shared parameter groups in both languages", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"two-groups.ts": [
					"class TypeScriptSharedInput {}",
					"class FirstTypeScriptService {",
					"  one(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  two(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  three(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  four(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"}",
					"class SecondTypeScriptService {",
					"  one(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  two(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  three(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  four(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"}",
				].join("\n"),
				"two_groups.py": [
					"class PythonSharedInput:",
					"    pass",
					"",
					"class FirstPythonService:",
					"    def one(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def two(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def three(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def four(self, python_value: PythonSharedInput):",
					"        return python_value",
					"",
					"class SecondPythonService:",
					"    def one(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def two(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def three(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def four(self, python_value: PythonSharedInput):",
					"        return python_value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);
		const typescript_shared = shared.filter((violation) => violation.file() === "two-groups.ts");
		const python_shared = shared.filter((violation) => violation.file() === "two_groups.py");

		expect({
			typescript: typescript_shared.map((violation) => violation.message()).sort(),
			python: python_shared.map((violation) => violation.message()).sort(),
		}).toEqual({
			typescript: [
				expect.stringContaining("FirstTypeScriptService.one"),
				expect.stringContaining("SecondTypeScriptService.one"),
			],
			python: [expect.stringContaining("FirstPythonService.one"), expect.stringContaining("SecondPythonService.one")],
		});
	});

	test("keeps constructors in their language-specific class method scopes", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"constructor.ts": [
					"class TypeScriptSharedInput {}",
					"class TypeScriptService {",
					"  constructor(ts_value: TypeScriptSharedInput) { void ts_value; }",
					"  first(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  second(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"  third(ts_value: TypeScriptSharedInput) { return ts_value; }",
					"}",
				].join("\n"),
				"constructor.py": [
					"class PythonSharedInput:",
					"    pass",
					"",
					"class PythonService:",
					"    def __init__(self, python_value: PythonSharedInput):",
					"        print(python_value)",
					"    def first(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def second(self, python_value: PythonSharedInput):",
					"        return python_value",
					"    def third(self, python_value: PythonSharedInput):",
					"        return python_value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);
		const typescript_shared = shared.filter((violation) => violation.file() === "constructor.ts");
		const python_shared = shared.filter((violation) => violation.file() === "constructor.py");
		const typescript_message = typescript_shared.map((violation) => violation.message()).join("\n");
		const python_message = python_shared.map((violation) => violation.message()).join("\n");

		expect({
			typescript: {
				messages: typescript_shared.map((violation) => violation.message()),
				service_present: typescript_message.includes("TypeScriptService."),
				candidates_present: typescript_message.includes("Candidates:"),
			},
			python: {
				messages: python_shared.map((violation) => violation.message()),
				service_present: python_message.includes("PythonService."),
				candidates_present: python_message.includes("Candidates:"),
			},
		}).toEqual({
			typescript: {
				messages: [expect.stringContaining("TypeScriptService.")],
				service_present: true,
				candidates_present: true,
			},
			python: {
				messages: [expect.stringContaining("PythonService.")],
				service_present: true,
				candidates_present: true,
			},
		});
	});
});
