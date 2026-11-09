import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { CallableMetrics } from "src/metrics/callable_metrics";
import type { ViolationContract } from "src/reporting_protocols";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import {
	ARGUMENT_FUNCTION_NODE,
	SHORT_FUNCTION_NODE,
	SHORT_METHOD_CLASS,
} from "tests/core/constants/ast_nodes/constants";
import { TestFixture } from "tests/core/test-fixture";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("AST metric rules", () => {
	test("applies function metrics from normalized nodes", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(violations, "helper.py", ARGUMENT_FUNCTION_NODE, false, new LintStageTimer());
		metrics.append_callable_metrics();

		const messages = violations.map((item) => item.message());
		const all_violations_on_expected_line = violations.every((item) => item.line() === 5);
		expect({ messages, all_violations_on_expected_line }).toEqual({
			messages: expect.arrayContaining([
				expect.stringContaining("function is too short"),
				expect.stringContaining("function has too many arguments (found 6)"),
			]),
			all_violations_on_expected_line: true,
		});
	});

	test("allows functions and methods up to 100 characters despite line minimum", () => {
		const test_fixture = new TestFixture();
		const functionViolations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			functionViolations,
			"short.ts",
			SHORT_FUNCTION_NODE,
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();
		const methodViolations: ViolationContract[] = [];
		test_fixture._ast_nodes.append_class_violations(methodViolations, "Service.ts", SHORT_METHOD_CLASS);

		const method_has_size_violation = methodViolations.some((item) => item.message().includes("method has"));
		expect({ functionViolations, method_has_size_violation }).toEqual({
			functionViolations: [],
			method_has_size_violation: false,
		});
	});

	test("keeps the minimum-line violation above the 100-character boundary", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"long-enough.ts",
			test_fixture._ast_nodes.callable_node({
				name: "longEnoughFunction",
				start: 4,
				end: 5,
				argument_count: 0,
				characters: 101,
				exception_only: false,
				lines: 2,
				sloc: 2,
				control_flow_depth: 0,
				visibility: "public",
			}),
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message())).toContain("function is too short");
	});

	test("does not allow the character exception for private methods", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"private.ts",
			test_fixture._ast_nodes.callable_node({
				name: "helper",
				start: 4,
				end: 5,
				argument_count: 0,
				lines: 2,
				sloc: 2,
				characters: 100,
				control_flow_depth: 0,
				exception_only: false,
				visibility: "private",
			}),
			true,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message())).toContain("method is too short");
	});

	test("ignores a multiline signature when counting body lines", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"inline-state.ts",
			test_fixture._ast_nodes.callable_node({
				name: "run_edit_flow",
				start: 4,
				end: 20,
				lines: 17,
				sloc: 2,
				argument_count: 2,
				characters: 100,
				control_flow_depth: 0,
				exception_only: false,
				visibility: "public",
			}),
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations).toEqual([]);
	});

	test("uses the combined body-size metric for the maximum size", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"large.ts",
			test_fixture._ast_nodes.callable_node({
				name: "largeFunction",
				start: 0,
				end: 30,
				lines: 31,
				sloc: 2,
				argument_count: 0,
				characters: 101,
				control_flow_depth: 0,
				exception_only: false,
				visibility: "public",
			}),
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message())).toEqual(["function is too long"]);
	});

	test("reports callable control-flow nesting above the shared limit", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"nested.ts",
			test_fixture._ast_nodes.callable_node({
				name: "nested",
				start: 6,
				end: 20,
				lines: 14,
				sloc: 14,
				argument_count: 0,
				characters: 101,
				control_flow_depth: 4,
				exception_only: false,
				visibility: "public",
			}),
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.rule_id())).toContain("callable-nesting-depth");
	});

	test("uses the average of body lines and SLOC for minimum size", () => {
		const test_fixture = new TestFixture();
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"average.ts",
			test_fixture._ast_nodes.callable_node({
				name: "averageFunction",
				start: 0,
				end: 2,
				lines: 2,
				sloc: 3,
				argument_count: 0,
				characters: 101,
				control_flow_depth: 0,
				exception_only: false,
				visibility: "public",
			}),
			false,
			new LintStageTimer(),
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message())).toContain("function is too short");
	});

	test("detects class and function ownership mix from source code", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"mixed.ts": "class Service { public read(): number { return 1; } }\nfunction build(): number { return 1; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const mixed = violations.filter((violation) => violation.rule_id() === "mixed-module");
		expect({
			count: mixed.length,
			lines: mixed.map((item) => item.line()),
			messages: mixed.map((item) => item.message().includes("mixing classes and functions")),
		}).toEqual({ count: 1, lines: [1], messages: [true] });
	});

	test("keeps imported interfaces independent from same-named classes", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"port.ts": "export interface Item { value: number; }",
				"use.ts": [
					"import type { Item } from './port';",
					"export function use(value: Item): number { return value.value; }",
				].join("\n"),
				"other.ts": "export class Item { public value = 1; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const use_boundary_violations = violations.filter(
			(violation) => violation.file() === "use.ts" && violation.rule_id() === "project-type-boundary",
		);

		expect(use_boundary_violations).toEqual([]);
	});

	test("detects mixed ownership for the ignored Facebook API path", () => {
		const file = "scripts/webpage/src/facebook/facebook-api.ts";
		const text =
			'import { External } from "external";\nexport class Api {}\nexport function create_api() { return new Api(); }';
		const source_file = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));
		expect(
			scenario
				.state()
				.project.rule_scope.source_files("typescript")
				.map((source) => source.relative_path),
		).toEqual([file]);
		expect(scenario.rule_ids()).toContain("mixed-module");
	});
});
