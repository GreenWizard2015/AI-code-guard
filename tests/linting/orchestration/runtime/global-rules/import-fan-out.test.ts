import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import { ImportFanOut } from "src/linting/orchestration/runtime/global-rules/import_fan_out";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ViolationContract } from "src/reporting_protocols";

describe("Python import fan-out", () => {
	test("reports more than twenty unique module paths", () => {
		const ast_model = new AstModel("python");
		const empty_ast = ast_model.empty_ast_file();
		const ast_file = new TypeScriptAstFile("fanout.py", "");
		const source_file = ast_file.source_file_node();
		const normalized_ast = {
			...empty_ast,
			source: {
				...empty_ast.source,
				python_imports: Array.from({ length: 21 }, (_, index) => ({
					line: index + 1,
					kind: "from" as const,
					module: `module_${index}`,
					names: [{ name: `value_${index}`, alias: "" }],
				})),
			},
		};
		const source = {
			absolute_path: "/project/fanout.py",
			relative_path: "fanout.py",
			file_name: new LintFileName("fanout.py"),
			text: "",
			normalized_ast,
			language: "python" as const,
			typescript_ast: new TypeScriptAstFile("/project/fanout.py", ""),
			source_resolver: new Map(),
			traversal: new TypeScriptAstTraversal(source_file),
		};
		const violations: ViolationContract[] = [];
		const rule = new ImportFanOut(20, new DiagnosticRule("import-fan-out"));

		rule.append(violations, source);

		expect(violations).toHaveLength(1);
	});

	test("allows twenty unique module paths", () => {
		const ast_model = new AstModel("python");
		const empty_ast = ast_model.empty_ast_file();
		const ast_file = new TypeScriptAstFile("fanout.py", "");
		const source_file = ast_file.source_file_node();
		const normalized_ast = {
			...empty_ast,
			source: {
				...empty_ast.source,
				python_imports: Array.from({ length: 20 }, (_, index) => ({
					line: index + 1,
					kind: "from" as const,
					module: `module_${index}`,
					names: [{ name: `value_${index}`, alias: "" }],
				})),
			},
		};
		const source = {
			absolute_path: "/project/fanout.py",
			relative_path: "fanout.py",
			file_name: new LintFileName("fanout.py"),
			text: "",
			normalized_ast,
			language: "python" as const,
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal: new TypeScriptAstTraversal(source_file),
		};
		const violations: ViolationContract[] = [];
		const rule = new ImportFanOut(20, new DiagnosticRule("import-fan-out"));

		rule.append(violations, source);

		expect(violations).toEqual([]);
	});
});
