import { describe, expect, test } from "@jest/globals";
import { LintFileName } from "src/core/context/lint_file_name";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { EMPTY_MUTATED_FIELDS } from "src/metrics/constants";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { ViolationContract } from "src/reporting_protocols";

describe("normalized AST class metrics", () => {
	test("accepts stateless contract adapters but reports an ordinary stateless helper", () => {
		const source = new TypeScriptAstFile(
			"rule.ts",
			[
				"interface ASTSourceRuleContract { active_for(code: string): boolean; }",
				"interface IOContract { file(path: string): string; }",
				"class RetryRule implements ASTSourceRuleContract { active_for(code: string): boolean { return code.length > 0; } }",
				"class MemoryIO implements IOContract { file(path: string): string { return path; } }",
				"class StatelessHelper { run(): void {} }",
			].join("\n"),
		);
		const violations: ViolationContract[] = [];
		for (const node of source.normalized().source.classes) {
			const reporter = new ClassStructureReporter({
				violations,
				file_name: new LintFileName("rule.ts"),
				node,
				suppress_short_class: false,
				mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
				project_class_names: new Set(),
				project_contract_names: new Set(["ASTSourceRuleContract", "IOContract"]),
				project_alias_names: new Set(),
				class_state: {
					constructor_injected_state: false,
					inherited_instance_state: false,
					inherited_state_names: new Set<string>(),
				},
			});

			reporter.report_design();
		}

		const stateless_violations = violations.filter((item) => item.rule_id() === "stateless-class");
		expect(stateless_violations).toHaveLength(1);
		expect(stateless_violations.map((item) => item.line())).toEqual([5]);
	});

	test("reports short class and method metrics from normalized nodes", () => {
		const long_literal = "x".repeat(101);
		const source = new TypeScriptAstFile(
			"service.ts",
			`class Service {\n run(): void { const value = '${long_literal}'; }\n}`,
		);
		const normalized_ast = source.normalized();
		const violations: ViolationContract[] = [];
		const file_name = new LintFileName("service.ts");
		for (const node of normalized_ast.source.classes) {
			const class_structure_reporter = new ClassStructureReporter({
				violations,
				file_name,
				node,
				suppress_short_class: false,
				mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
				project_class_names: new Set(node.structure.base_class_names),
				project_contract_names: new Set(node.structure.interfaces ?? []),
				project_alias_names: new Set(),
				class_state: {
					constructor_injected_state: false,
					inherited_instance_state: false,
					inherited_state_names: new Set<string>(),
				},
			});
			class_structure_reporter.report_class_methods();
			class_structure_reporter.report_sizes();
		}

		expect(violations.map((item) => item.message())).toEqual(
			expect.arrayContaining([
				expect.stringContaining("class is too short"),
				expect.stringContaining("method is too short"),
			]),
		);
	});

	test("reports argument metrics from normalized class methods", () => {
		const source = new TypeScriptAstFile("service.ts", "class Service {\n run(a, b, c, d, e, f): void {}\n}");
		const normalized_ast = source.normalized();
		const violations: ViolationContract[] = [];
		const file_name = new LintFileName("service.ts");
		for (const node of normalized_ast.source.classes) {
			const class_structure_reporter = new ClassStructureReporter({
				violations,
				file_name,
				node,
				suppress_short_class: false,
				mutated_readonly_fields: EMPTY_MUTATED_FIELDS,
				project_class_names: new Set(node.structure.base_class_names),
				project_contract_names: new Set(node.structure.interfaces ?? []),
				project_alias_names: new Set(),
				class_state: {
					constructor_injected_state: false,
					inherited_instance_state: false,
					inherited_state_names: new Set<string>(),
				},
			});
			class_structure_reporter.report_class_methods();
			class_structure_reporter.report_sizes();
		}

		expect(violations.map((item) => item.message())).toEqual(
			expect.arrayContaining([expect.stringContaining("function has too many arguments (found 6)")]),
		);
	});
});
