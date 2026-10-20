import { describe, expect, test } from "@jest/globals";
import { ClassStructureReporter } from "src/metrics/class_structure_reporter";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { LintFileName } from "src/core/context/lint_file_name";
import { ClassReporting } from "src/core/support/source-analysis/class_reporting";
import type { ViolationContract } from "src/reporting_protocols";

describe("normalized AST class metrics", () => {
	test("reports short class and method metrics from normalized nodes", () => {
		const long_literal = "x".repeat(101);
		const source = new TypeScriptAstFile(
			"service.ts",
			`class Service {\n run(): void { const value = '${long_literal}'; }\n}`,
		);
		const normalized_ast = source.normalized();
		const violations: ViolationContract[] = [];
		const class_reporting = new ClassReporting();
		const file_name = new LintFileName("service.ts");
		for (const node of normalized_ast.classes) {
			class_reporting.report_method_metrics(violations, file_name, node);
			const class_structure_reporter = new ClassStructureReporter(violations, file_name, node);
			class_structure_reporter.report_sizes();
		}

		expect(violations.map((item) => item.message)).toEqual(
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
		const class_reporting = new ClassReporting();
		const file_name = new LintFileName("service.ts");
		for (const node of normalized_ast.classes) {
			class_reporting.report_method_metrics(violations, file_name, node);
			const class_structure_reporter = new ClassStructureReporter(violations, file_name, node);
			class_structure_reporter.report_sizes();
		}

		expect(violations.map((item) => item.message)).toEqual(
			expect.arrayContaining([expect.stringContaining("function has too many arguments (found 6)")]),
		);
	});
});
