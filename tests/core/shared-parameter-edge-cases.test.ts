import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter lint integration", () => {
	test.each([
		[
			"TypeScript",
			{
				"named-contract.ts": [
					"interface ContextContract { readonly name: string; }",
					"class Service {",
					"  first(context: ContextContract) { return context.name; }",
					"  second(context: ContextContract) { return context.name; }",
					"  third(context: ContextContract) { return context.name; }",
					"}",
				].join("\n"),
			},
		],
		[
			"Python",
			{
				"named_contract.py": [
					"from typing import Protocol",
					"class ContextContract(Protocol):",
					"    name: str",
					"class Service:",
					"    def first(self, context: ContextContract) -> str:",
					"        return context.name",
					"    def second(self, context: ContextContract) -> str:",
					"        return context.name",
					"    def third(self, context: ContextContract) -> str:",
					"        return context.name",
				].join("\n"),
			},
		],
	])("includes already named %s parameter contract types", (_language, files) => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		expect(shared).toHaveLength(1);
		expect(shared.map((violation) => violation.message())).toEqual([
			expect.stringContaining("context:ContextContract"),
		]);
	});

	test("includes Python AST collection annotations in shared parameter analysis", () => {
		const test_fixture = new TestFixture();
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
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		expect(shared).toHaveLength(1);
		expect(shared.map((violation) => violation.message())).toEqual([
			expect.stringContaining("arguments:list[ast.arg]"),
		]);
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
		expect(shared).toHaveLength(1);
		expect(shared.map((violation) => violation.message())).toEqual([
			expect.stringContaining('parameter set "value:T"'),
		]);
	});

	test("supports Python generic reference annotations", () => {
		const test_fixture = new TestFixture();

		const methods = Array.from(
			{ length: 4 },
			(_, index) => `    def method_${index}(self, values: list[Result]):\n        return values`,
		);
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"generic.py": ["class Result:", "    pass", "", "class Service:", methods.join("\n")].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		expect(shared).toHaveLength(1);
		expect(shared.map((violation) => violation.message())).toEqual([
			expect.stringContaining('parameter set "values:list[Result]"'),
		]);
	});

	test("includes Python special methods in shared parameter analysis", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"special_method.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class Service:",
					"    def __eq__(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"    def accepts(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"    def stores(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"    def forwards(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);

		expect(shared.some((violation) => violation.message().includes("Service.__eq__"))).toBe(true);
	});

	test("includes groups made only of Python special methods", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"special_methods.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class Service:",
					"    def __eq__(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"    def __ne__(self, value: SharedInput) -> bool:",
					"        return bool(value)",
					"    def __lt__(self, value: SharedInput) -> bool:",
					"        return bool(value)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const shared = test_fixture.shared_violations(violations);
		const messages = shared.map((violation) => violation.message()).join("\n");
		expect({
			count: shared.length,
			equality: messages.includes("Service.__eq__"),
			inequality: messages.includes("Service.__ne__"),
			ordering: messages.includes("Service.__lt__"),
		}).toEqual({ count: 1, equality: true, inequality: true, ordering: true });
	});

	test("does not report parameters fixed by an external mapping contract", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
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

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test.each([
		[
			"TypeScript",
			{
				"two-groups.ts": [
					"class SharedInput {}",
					"class FirstService {",
					"  one(value: SharedInput) { return value; }",
					"  two(value: SharedInput) { return value; }",
					"  three(value: SharedInput) { return value; }",
					"  four(value: SharedInput) { return value; }",
					"}",
					"class SecondService {",
					"  one(value: SharedInput) { return value; }",
					"  two(value: SharedInput) { return value; }",
					"  three(value: SharedInput) { return value; }",
					"  four(value: SharedInput) { return value; }",
					"}",
				].join("\n"),
			},
		],
		[
			"Python",
			{
				"two_groups.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class FirstService:",
					"    def one(self, value: SharedInput):",
					"        return value",
					"    def two(self, value: SharedInput):",
					"        return value",
					"    def three(self, value: SharedInput):",
					"        return value",
					"    def four(self, value: SharedInput):",
					"        return value",
					"",
					"class SecondService:",
					"    def one(self, value: SharedInput):",
					"        return value",
					"    def two(self, value: SharedInput):",
					"        return value",
					"    def three(self, value: SharedInput):",
					"        return value",
					"    def four(self, value: SharedInput):",
					"        return value",
				].join("\n"),
			},
		],
	])("reports two independent %s class groups", (_language, files) => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);
		const messages = shared.map((violation) => violation.message());
		const distinct_messages = new Set(messages);

		expect({
			count: shared.length,
			different: distinct_messages.size === 2,
			first: messages.join("\n").includes("FirstService.one"),
			second: messages.join("\n").includes("SecondService.one"),
		}).toEqual({ count: 2, different: true, first: true, second: true });
	});

	test.each([
		[
			"TypeScript",
			{
				"constructor.ts": [
					"class SharedInput {}",
					"class Service {",
					"  constructor(value: SharedInput) { void value; }",
					"  first(value: SharedInput) { return value; }",
					"  second(value: SharedInput) { return value; }",
					"  third(value: SharedInput) { return value; }",
					"}",
				].join("\n"),
			},
		],
		[
			"Python",
			{
				"constructor.py": [
					"class SharedInput:",
					"    pass",
					"",
					"class Service:",
					"    def __init__(self, value: SharedInput):",
					"        print(value)",
					"    def first(self, value: SharedInput):",
					"        return value",
					"    def second(self, value: SharedInput):",
					"        return value",
					"    def third(self, value: SharedInput):",
					"        return value",
				].join("\n"),
			},
		],
	])("keeps the %s constructor in its class method scope", (_language, files) => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = test_fixture.shared_violations(violations);

		expect({
			count: shared.length,
			service: shared
				.map((violation) => violation.message())
				.join("\n")
				.includes("Service."),
			candidates: shared
				.map((violation) => violation.message())
				.join("\n")
				.includes("Candidates:"),
		}).toEqual({ count: 1, service: true, candidates: true });
	});
});
