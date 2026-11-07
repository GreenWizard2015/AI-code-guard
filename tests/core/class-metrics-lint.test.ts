import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { DECORATED_PLUGIN_SOURCE, SPECIALIZATION_SOURCE } from "tests/core/constants/ast_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint class metrics rules", () => {
	test("does not report public method count driven by an implemented interface", () => {
		const methods = ["one", "two", "three", "four", "five", "six", "seven"];
		const contract = methods.map((method) => `  ${method}(): number;`);
		const implementation = methods.map((method) => `  ${method}(): number { return 1; }`);
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"wide-adapter.ts": [
					`interface WideContract {\n${contract.join("\n")}\n}`,
					`class WideAdapter implements WideContract {\n${implementation.join("\n")}\n}`,
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "class-method-count-info")).toEqual([]);
	});

	test("recognizes state inherited from a project base class", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/project_rule.ts": [
					"export abstract class ProjectRule {",
					"  private readonly cache: WeakMap<object, string>;",
					"  public constructor(cache: WeakMap<object, string>) { this.cache = cache; }",
					"  protected cache_contains(key: object): boolean { return this.cache.has(key); }",
					"  protected abstract collect(): string[];",
					"}",
				].join("\n"),
				"src/first_rule.ts": [
					"import { ProjectRule } from './project_rule';",
					"export class FirstRule extends ProjectRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/second_rule.ts": [
					"import { ProjectRule } from './project_rule';",
					"export class SecondRule extends ProjectRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/third_rule.ts": [
					"import { ProjectRule } from './project_rule';",
					"export class ThirdRule extends ProjectRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/fourth_rule.ts": [
					"import { ProjectRule } from './project_rule';",
					"export class FourthRule extends ProjectRule { protected collect(): string[] { return []; } }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "stateless-class")
				.map((item) => item.file())
				.sort(),
		).toEqual([]);
	});

	test("reports TypeScript class thresholds, callback fields, and interface exemptions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"specialization.ts": SPECIALIZATION_SOURCE,
				"callbacks.ts": [
					"const callback = () => 1;",
					"const [array_callback] = [() => 2];",
					"class InlineCallbacks {",
					"  on_one = () => 1; on_two = () => 2; on_three = () => 3; on_four = () => 4;",
					"  run() {} reset() {}",
					"}",
					"class AliasedCallbacks { handler = callback; run() {} reset() {} }",
					"class ArrayAliasedCallbacks { handler = array_callback; run() {} reset() {} }",
					"interface Contract { run(): void; }",
					"interface ExtendedContract extends Contract {}",
					"class Adapter implements Contract { run() {} }",
					"class QualifiedAdapter implements External.Contract { run() {} }",
					"class Base { run() {} }",
					"class InheritedAdapter extends Base { run() {} }",
					"interface InvalidContract extends Base {}",
					"type PlainShape = { value: string; };",
					"interface InvalidShapeContract extends PlainShape {}",
					'class ShapeAdapter implements PlainShape { value = ""; }',
					"type LintSourceRecord = { file: string; };",
					'class PythonLintSourceRecord implements LintSourceRecord { file = ""; }',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const details = violations.map((item) => [item.message(), item.priority(), item.rule_id()]);
		const inheritance_diagnostics = violations
			.filter((item) => item.rule_id() === "local-inheritance")
			.map((item) => item.message())
			.sort();

		expect({
			class_thresholds: details,
			inheritance_diagnostics,
			info_count: details.filter((item) => item[0] === "class has many public methods (found 7)").length,
			four_callbacks: violations.filter(
				(item) => item.message() === "class has 4 callback fields with default implementations",
			).length,
			one_callback: violations.filter(
				(item) => item.message() === "class has 1 callback fields with default implementations",
			).length,
			callback_class_minimum: violations.filter(
				(item) => item.file() === "callbacks.ts" && item.message() === "class has too few public methods (found 1)",
			).length,
		}).toEqual({
			class_thresholds: expect.arrayContaining([
				["class has too few public methods (found 1)", 6, "class-method-min-count"],
				["class has many public methods (found 7)", 1, "class-method-count-info"],
				["class has too many public methods (found 16)", 3, "class-method-max-count"],
			]),
			info_count: 1,
			inheritance_diagnostics: [
				'declaration inherits from non-contract base "Base"',
				'declaration inherits from non-contract base "Base"',
				'declaration inherits from non-contract base "PlainShape"',
				'declaration inherits from non-contract base "PlainShape"',
				'declaration inherits from non-contract base "LintSourceRecord"',
			].sort(),
			four_callbacks: 1,
			one_callback: 2,
			callback_class_minimum: 1,
		});
	});

	test("keeps protocol classification structural and analyzes decorated methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"protocol.py": [
					"from typing import Protocol",
					"class Contract(Protocol):",
					"    def run(self) -> None: ...",
					"class ExtendedContract(Contract, Protocol):",
					"    def close(self) -> None: ...",
					"class Adapter(Contract):",
					"    def run(self) -> None:",
					"        return None",
					"class ConcreteProtocol(ConcreteBase, Protocol):",
					"    def read(self) -> str:",
					'        return ""',
					"class ConcreteBase:",
					"    def read(self) -> str:",
					'        return ""',
					"    def close(self) -> None:",
					"        return None",
					"class ConcreteAdapter(ConcreteBase):",
					"    def read(self) -> str:",
					'        return ""',
					"    def close(self) -> None:",
					"        return None",
					"PlainShape = dict[str, str]",
					"class ShapeAdapter(PlainShape):",
					"    pass",
				].join("\n"),
				"plugin.py": DECORATED_PLUGIN_SOURCE,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			inheritance_diagnostics: violations
				.filter((item) => item.file() === "protocol.py" && item.rule_id() === "local-inheritance")
				.map((item) => item.message())
				.sort(),
			minimum_method_count: violations.filter((item) => item.message() === "class has too few public methods (found 1)")
				.length,
			method_count_info: violations.filter((item) => item.rule_id() === "class-method-count-info").length,
			unused_plugin_callables: violations.filter(
				(item) => item.file() === "plugin.py" && item.rule_id() === "unused-callable",
			).length,
		}).toEqual({
			inheritance_diagnostics: [
				'declaration inherits from non-contract base "ConcreteBase"',
				'declaration inherits from non-contract base "ConcreteBase"',
				'declaration inherits from non-contract base "PlainShape"',
			],
			minimum_method_count: 0,
			method_count_info: 0,
			unused_plugin_callables: 6,
		});
	});

	test("reports the same diagnostics when project files are parsed in reverse order", () => {
		const fixture = new TestFixture();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const files = {
			"src/entry.ts": 'import { Child } from "./child";\nexport const child = new Child();\n',
			"src/child.ts": 'import { Parent } from "./parent";\nexport class Child extends Parent {}\n',
			"src/parent.ts": 'import "./child";\nexport class Parent {}\n',
		};
		const forward_request = fixture.fixture_lint_request(files);
		const forward_diagnostics = configuration
			.lint_report(forward_request.options, forward_request.mode)
			.report.violations.map((violation) =>
				JSON.stringify([
					violation.file(),
					violation.line(),
					violation.rule_id(),
					violation.message(),
					violation.hint(),
					violation.priority(),
				]),
			)
			.sort();
		const reverse_request = fixture.fixture_lint_request(files);
		const reverse_inputs = reverse_request.options.inputs;
		reverse_inputs.files.reverse();
		reverse_inputs.project_files.reverse();
		const reverse_diagnostics = configuration
			.lint_report(reverse_request.options, reverse_request.mode)
			.report.violations.map((violation) =>
				JSON.stringify([
					violation.file(),
					violation.line(),
					violation.rule_id(),
					violation.message(),
					violation.hint(),
					violation.priority(),
				]),
			)
			.sort();

		expect(forward_diagnostics).toEqual(reverse_diagnostics);
		expect(forward_diagnostics.some((diagnostic) => diagnostic.includes('"local-inheritance"'))).toBe(true);
	});
});
