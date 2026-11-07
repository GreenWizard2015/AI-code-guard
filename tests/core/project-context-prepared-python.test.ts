import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { PYTHON_LANGUAGE } from "src/constants";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { SourceText } from "src/io/source_text";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptSourceRuleRuntime } from "src/linting/orchestration/runtime/typescript/type_script_source_rule_runtime";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import type { PreparedPythonLintInput } from "tests/core/types";

describe("project context prepared Python AST", () => {
	const ast_model = new AstModel("python");
	const empty_ast = ast_model.empty_ast_file();
	/** Responsibilities: _Python AST input_. **/
	const prepared_ast = (
		coding_issues: typeof empty_ast.source.coding_issues,
	): LintSourceRecordData["normalized_ast"] => ({
		...empty_ast,
		source: {
			...empty_ast.source,
			coding_issues,
		},
	});
	/** Responsibilities: _lint input data_. **/
	const prepare_lint_input = (normalized_ast: LintSourceRecordData["normalized_ast"]): PreparedPythonLintInput => {
		const source_text = "this is not Python syntax";
		const ast_file = new TypeScriptAstFile("prepared.py", source_text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const source_record: LintSourceRecordData = {
			absolute_path: resolve("prepared.py"),
			relative_path: "prepared.py",
			file_name: new LintFileName("prepared.py"),
			text: source_text,
			normalized_ast,
			language: PYTHON_LANGUAGE,
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
		const source_ast = new SourceFileAst(
			{ file: "prepared.py", text: source_text },
			normalized_ast,
			ast_file.source_file_node(),
			new Map(),
			traversal,
		);
		const module_exports_context = new TypeScriptModuleExportsContext(
			process.cwd(),
			source_record.source_resolver,
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		return { source_record, source_ast, module_exports_context };
	};

	test("uses the prepared Python AST without reparsing source text", () => {
		const { source_record, source_ast, module_exports_context } = prepare_lint_input(
			prepared_ast([{ line: 0, kind: "python-elif", name: "" }]),
		);
		const module_exports = module_exports_context.module_exports();
		const runtime = new TypeScriptSourceRuleRuntime(source_record, EMPTY_PROJECT_NAMES, module_exports);
		const linter = new CodingRuleLinter(runtime, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_python(source_ast);

		expect(violations.map((violation) => [violation.line(), violation.rule_id()])).toEqual([[1, "python-elif"]]);
	});

	test("does not reparse invalid Python source when the prepared AST has no coding issues", () => {
		const { source_record, source_ast, module_exports_context } = prepare_lint_input(prepared_ast([]));
		const module_exports = module_exports_context.module_exports();
		const runtime = new TypeScriptSourceRuleRuntime(source_record, EMPTY_PROJECT_NAMES, module_exports);
		const linter = new CodingRuleLinter(runtime, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_python(source_ast);

		expect(violations).toEqual([]);
	});
});
