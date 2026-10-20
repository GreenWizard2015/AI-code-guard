import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/lint_stage_timer";
import { TestFixture } from "tests/core/test-fixture";
import { TypeScriptScannerAssembly } from "src/linting/orchestration/runtime/type_script_scanner_assembly";
import { LintStageTimer } from "src/lint_stage_timer";
import { CallableMetrics } from "src/metrics/callable_metrics";
import type { ViolationContract } from "src/reporting_protocols";
import { LintFileName } from "src/core/context/lint_file_name";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { EmptySourceText } from "src/io/empty_source_text";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import {
	ARGUMENT_FUNCTION_NODE,
	SHORT_FUNCTION_NODE,
	SHORT_METHOD_CLASS,
} from "tests/core/constants/ast_nodes/constants";

describe("AST metric rules", () => {
	test("applies function metrics from normalized nodes", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(violations, "helper.py", ARGUMENT_FUNCTION_NODE, false);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("function is too short"),
				expect.stringContaining("function has too many arguments (found 6)"),
			]),
		);
		expect(violations.every((item) => item.line === 5)).toBe(true);
	});

	test("allows functions and methods up to 100 characters despite line minimum", () => {
		const test_fixture = new TestFixture();
		const functionViolations: ViolationContract[] = [];
		const metrics = new CallableMetrics(functionViolations, "short.ts", SHORT_FUNCTION_NODE, false);
		metrics.append_callable_metrics();
		const methodViolations: ViolationContract[] = [];
		test_fixture.ast_nodes.append_class_violations(methodViolations, "Service.ts", SHORT_METHOD_CLASS);

		expect(functionViolations).toEqual([]);
		expect(methodViolations.some((item) => item.message.includes("method has"))).toBe(false);
	});

	test("keeps the minimum-line violation above the 100-character boundary", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"long-enough.ts",
			{
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
			},
			false,
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message)).toContain("function is too short");
	});

	test("does not allow the character exception for private methods", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"private.ts",
			{
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
			},
			true,
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message)).toContain("method is too short");
	});

	test("ignores a multiline signature when counting body lines", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"inline-state.ts",
			{
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
			},
			false,
		);
		metrics.append_callable_metrics();

		expect(violations).toEqual([]);
	});

	test("uses the combined body-size metric for the maximum size", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"large.ts",
			{
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
			},
			false,
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message)).toEqual(["function is too long"]);
	});

	test("reports callable control-flow nesting above the shared limit", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"nested.ts",
			{
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
			},
			false,
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.rule_id)).toContain("callable-nesting-depth");
	});

	test("uses the average of body lines and SLOC for minimum size", () => {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(
			violations,
			"average.ts",
			{
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
			},
			false,
		);
		metrics.append_callable_metrics();

		expect(violations.map((item) => item.message)).toContain("function is too short");
	});

	test("detects class and function ownership mix from source code", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"mixed.ts": "class Service { public read(): number { return 1; } }\nfunction build(): number { return 1; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const mixed = violations.filter((violation) => violation.rule_id === "mixed-module");
		expect({
			count: mixed.length,
			line: mixed[0]?.line,
			message: mixed[0]?.message.includes("mixing classes and functions"),
		}).toEqual({ count: 1, line: 1, message: true });
	});

	test("detects mixed ownership for the ignored Facebook API path", () => {
		const file = "scripts/webpage/src/facebook/facebook-api.ts";
		const text = "export class Api {}\nexport function create_api() { return new Api(); }";
		const assembly = new TypeScriptScannerAssembly();
		const ast_file = new TypeScriptAstFile(file, text);
		const violations = assembly.scan_mixed_module({
			file_name: new LintFileName(file),
			text,
			project_class_names: new Set(),
			typescript_class_names: new Set(),
			project_interface_names: new Set(),
			project_type_names: new Set(),
			project_contract_names: new Set(),
			project_boundary_types: new Set(),
			project_boundary_contracts: new Set(),
			module_resolver: new TypeScriptModuleExports("/tmp", new Map(), false, new EmptySourceText()),
			project_files: new Set(),
			ast_file,
			traversal: ast_file.traversal,
			stage_timer: new LintStageTimer(),
		});
		expect(violations.map((violation) => violation.message)).toContain(
			"avoid mixing classes and functions in the same file",
		);
	});

	test("keeps imported interfaces independent from same-named classes", () => {
		const port_file = "/project/port.ts";
		const use_file = "/project/use.ts";
		const other_file = "/project/other.ts";
		const port_text = "export interface Item { value: number; }";
		const use_text =
			"import type { Item } from './port'; export function use(value: Item): number { return value.value; }";
		const other_text = "export class Item { public value = 1; }";
		const port_ast = new TypeScriptAstFile(port_file, port_text);
		const use_ast = new TypeScriptAstFile(use_file, use_text);
		const other_ast = new TypeScriptAstFile(other_file, other_text);
		const source_files = new Map([
			[port_file, port_ast.source_file_node()],
			[use_file, use_ast.source_file_node()],
			[other_file, other_ast.source_file_node()],
		]);
		const assembly = new TypeScriptScannerAssembly();
		const violations = assembly.scan({
			file_name: new LintFileName(use_file),
			text: use_text,
			ast_file: use_ast,
			traversal: use_ast.traversal,
			project_class_names: new Set(["Item"]),
			typescript_class_names: new Set(["Item"]),
			project_interface_names: new Set(["Item"]),
			project_type_names: new Set(["Item"]),
			project_contract_names: new Set(["Item"]),
			project_boundary_types: new Set(["Item"]),
			project_boundary_contracts: new Set(),
			module_resolver: new TypeScriptModuleExports("/project", source_files, false, new EmptySourceText()),
			project_files: new Set([port_file, use_file, other_file]),
			stage_timer: new LintStageTimer(),
		});

		expect(violations.filter((violation) => violation.rule_id === "project-type-boundary")).toEqual([]);
	});
});
