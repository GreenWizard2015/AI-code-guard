import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { LintFileName } from "src/core/context/lint_file_name";
import type { PythonRuleInput } from "src/linting/types";

/** Responsibilities: _Python source AST construction_, _rule input assembly_. **/
export class ParsedPythonSource {
	private readonly python_ast: PythonAstData;

	/** Responsibilities: _Python AST data_. **/
	public constructor() {
		this.python_ast = new PythonAstData(new PythonAstBridge());
	}

	/** Responsibilities: _Python source AST_. **/
	public parse(file: string, text: string): SourceFileAst {
		const typescript_ast = new TypeScriptAstFile(file, text);
		return new SourceFileAst(
			{ file, text },
			this.python_ast.source_ast(text),
			typescript_ast.source_file_node(),
			new Map(),
			typescript_ast.traversal,
		);
	}

	/** Responsibilities: _Python rule input_. **/
	public rule_input(file: string, text: string): PythonRuleInput {
		const ast = this.parse(file, text).snapshot().normalized_ast;
		return {
			violations: [],
			file_name: new LintFileName(file),
			classes: ast.classes,
			functions: ast.functions,
			reference_aliases: ast.reference_aliases,
			python_imports: ast.python_imports,
			operations: {
				callables: ast.functions,
				attribute_accesses: [],
				private_accesses: [],
				repeated_branches: [],
				functions: ast.functions,
				parse_issues: ast.parse_issues,
				named_symbols: ast.named_symbols,
				symbol_references: ast.symbol_references,
			},
			project_class_names: new Set(),
			project_protocol_names: new Set(),
			project_type_names: new Set(),
			suppress_short_class: false,
			production_import_names: new Set(),
		};
	}
}
