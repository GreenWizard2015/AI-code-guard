import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import ts from "typescript";

/** Responsibilities: _class nesting_, _source boundaries_. **/
export class ClassStructure {
	private readonly _file: string;
	private readonly _lines: string[];
	private readonly _python: boolean;
	private readonly _parsed_indexes: number[];
	private readonly top_level_indentation = 0;
	private readonly _nested_scope_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _source indentation width_. **/
	private indentation(line: string): number {
		let index = 0;
		while (index < line.length) {
			if (line[index] === " ") {
				index += 1;
				continue;
			}
			if (line[index] === "\t") {
				index += 1;
				continue;
			}
			break;
		}
		return index;
	}

	/** Responsibilities: _class header terminator_. **/
	private header_end(character: string): boolean {
		if (character === ":") {
			return true;
		}
		if (character === "(") {
			return true;
		}
		if (character === " ") {
			return true;
		}
		return character === "\t";
	}

	/** Responsibilities: _class header detection_. **/
	private class_header(line: string): boolean {
		const code = line.slice(this.indentation(line));
		if (!code.startsWith("class ")) {
			return false;
		}
		const name = code.slice(6);
		const name_characters = [...name];
		const end = name_characters.findIndex((character) => this.header_end(character));
		let class_name = name;
		if (end >= 0) {
			class_name = name.slice(0, end);
		}
		return class_name.length > 0;
	}

	/** Responsibilities: _nested Python class lookup_. **/
	private nested_python_classes(): number[] {
		const indexes: number[] = [];
		for (const [index, line] of this._lines.entries()) {
			if (this.indentation(line) > this.top_level_indentation && this.class_header(line)) {
				indexes.push(index);
			}
		}
		return indexes;
	}

	/** Responsibilities: _selection parsing TypeScript source_. **/
	private typescript_source_file(): ts.SourceFile {
		const source_text = this._lines.join("\n");
		const ast_file = new TypeScriptAstFile(this._file, source_text);
		return ast_file.source_file_node();
	}

	/** Responsibilities: _nested TypeScript class lookup_. **/
	private nested_typescript_classes(): number[] {
		const source_file = this.typescript_source_file();
		const indexes: number[] = [];
		const visit = (node: ts.Node, inside_nested_scope: boolean): void => {
			const is_class = this.is_class_node(node);
			if (is_class && inside_nested_scope) {
				indexes.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line);
			}
			let child_nested_scope = inside_nested_scope;
			if (is_class) {
				child_nested_scope = true;
			}
			if (this.is_nested_scope(node)) {
				child_nested_scope = true;
			}
			ts.forEachChild(node, (child) => visit(child, child_nested_scope));
		};
		visit(source_file, false);
		return indexes;
	}

	/** Responsibilities: _classification nested TypeScript scope_. **/
	private is_nested_scope(node: ts.Node): boolean {
		if (ts.isClassLike(node) || ts.isFunctionLike(node)) {
			return true;
		}
		if (ts.isBlock(node)) {
			return true;
		}
		if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
			return true;
		}
		if (ts.isPropertyAssignment(node) || ts.isConditionalExpression(node)) {
			return true;
		}
		return this._nested_scope_kinds.has(node.kind);
	}

	/** Responsibilities: _classification TypeScript AST node_. **/
	private is_class_node(node: ts.Node): boolean {
		if (ts.isClassDeclaration(node)) {
			return true;
		}
		return ts.isClassExpression(node);
	}

	/** Responsibilities: _source-file structure analysis initialization_. **/
	public constructor(file: string, lines: string[], python: boolean, parsed_indexes: number[]) {
		this._file = file;
		this._lines = lines;
		this._python = python;
		this._parsed_indexes = parsed_indexes;
		this._nested_scope_kinds = new Set([
			ts.SyntaxKind.Block,
			ts.SyntaxKind.ObjectLiteralExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
			ts.SyntaxKind.CaseBlock,
		]);
	}

	/** Responsibilities: _aggregation nested-class violations source_. **/
	public append_nested_class(violations: ViolationContract[]): void {
		let indexes: number[];
		if (this._python) {
			indexes = this.nested_python_classes();
		} else {
			indexes = this.nested_typescript_classes();
		}
		if (indexes.length === 0) {
			return;
		}
		const rule = new DiagnosticRule("nested-class");
		const first_index = indexes.at(0);
		if (first_index !== undefined) {
			violations.push(rule.violation(this._file, first_index + 1, { count: String(indexes.length) }));
		}
	}

	/** Responsibilities: _output top-level class indexing_. **/
	public class_indexes(): number[] {
		return this._parsed_indexes;
	}
}
