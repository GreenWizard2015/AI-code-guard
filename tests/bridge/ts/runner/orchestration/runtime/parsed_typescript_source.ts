import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

/** Responsibilities: _syntax tree_, _source record_. **/
export class ParsedTypeScriptSource {
	/** Responsibilities: _source AST state_. **/
	public parse(file: string, text: string): SourceFileAst {
		const ast_file = new TypeScriptAstFile(file, text);
		return new SourceFileAst(
			{ file, text },
			ast_file.normalized(),
			ast_file.source_file_node(),
			new Map(),
			ast_file.traversal,
		);
	}
}
