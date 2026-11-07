import { LintFileName } from "src/core/context/lint_file_name";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import type { PythonRuleInput } from "src/linting/types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";

/** Responsibilities: _source ASTs_, _Python rule inputs_. **/
export class ParsedSourceFiles {
	private readonly _python_ast: PythonAstData;

	/** Responsibilities: _Python AST data_. **/
	public constructor() {
		const python_ast_bridge = new PythonAstBridge();
		const python_ast_options = python_ast_bridge.options();
		this._python_ast = new PythonAstData(python_ast_options);
	}

	/** Responsibilities: _Python source AST_. **/
	public parse_python(file: string, text: string): SourceFileAst {
		const typescript_ast = new TypeScriptAstFile(file, text);
		return new SourceFileAst(
			{ file, text },
			this._python_ast.source_ast(text),
			typescript_ast.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(typescript_ast.source_file_node()),
		);
	}

	/** Responsibilities: _TypeScript source AST_. **/
	public parse_typescript(file: string, text: string): SourceFileAst {
		const ast_file = new TypeScriptAstFile(file, text);
		return new SourceFileAst(
			{ file, text },
			ast_file.normalized(),
			ast_file.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(ast_file.source_file_node()),
		);
	}

	/** Responsibilities: _Python rule input_. **/
	public rule_input(file: string, text: string): PythonRuleInput {
		const ast = this.parse_python(file, text).snapshot().normalized_ast;
		const functions = ast.source.functions;
		const methods = ast.source.classes.flatMap((node) => node.structure.methods);
		return {
			violations: [],
			file_name: new LintFileName(file),
			source: {
				text,
				classes: ast.source.classes,
				type_declarations: ast.references.type_declarations,
				functions: ast.source.functions,
				reference_aliases: ast.references.reference_aliases,
				python_imports: ast.source.python_imports,
			},
			operations: {
				callables: functions.concat(methods),
				methods,
				attribute_accesses: [],
				private_accesses: [],
				repeated_branches: [],
				functions,
				parse_issues: ast.source.parse_issues,
				named_symbols: ast.references.named_symbols,
				symbol_references: ast.references.symbol_references,
			},
			project: {
				classes: new Set(),
				protocols: new Set(),
				types: new Set(),
				type_aliases: new Set(),
				suppress_short_class: false,
				production_import_names: new Set(),
			},
		};
	}
}
