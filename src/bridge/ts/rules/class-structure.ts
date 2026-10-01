import { DiagnosticRule } from "src/model/diagnostic-rule";
import { TypeScriptAstFile } from "src/model/typescript-ast";
import type { Violation } from "src/protocols";
import ts from "typescript";

/** Responsibilities: _top-level nested Python lookup_. **/
export class ClassStructure {
	private readonly top_level_indentation = 0;

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
		const end = [...name].findIndex((character) => this.header_end(character));
		let class_name = name;
		if (end >= 0) {
			class_name = name.slice(0, end);
		}
		return class_name.length > 0;
	}

	/** Responsibilities: _nested Python class lookup_. **/
	private nested_python_classes(lines: string[]): number[] {
		const indexes: number[] = [];
		for (const [index, line] of lines.entries()) {
			if (this.indentation(line) > this.top_level_indentation) {
				if (this.class_header(line)) {
					indexes.push(index);
				}
			}
		}
		return indexes;
	}

	/** Responsibilities: _selection parsing TypeScript source_. **/
	private typescript_source_file(file: string, lines: string[], ...source_files: ts.SourceFile[]): ts.SourceFile {
		if (source_files.length === 0) {
			return new TypeScriptAstFile(file, lines.join("\n")).source_file;
		}
		return source_files[0];
	}

	/** Responsibilities: _nested TypeScript class lookup_. **/
	private nested_typescript_classes(file: string, lines: string[], ...source_files: ts.SourceFile[]): number[] {
		const source_file = this.typescript_source_file(file, lines, ...source_files);
		const indexes: number[] = [];
		const visit = (node: ts.Node, inside_nested_scope: boolean): void => {
			const is_class = this.is_class_node(node);
			if (is_class) {
				if (inside_nested_scope) {
					indexes.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line);
				}
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
		if (ts.isModuleBlock(node) || ts.isBlock(node)) {
			return true;
		}
		if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
			return true;
		}
		if (ts.isPropertyAssignment(node) || ts.isConditionalExpression(node)) {
			return true;
		}
		return ts.isCaseBlock(node);
	}

	/** Responsibilities: _classification TypeScript AST node_. **/
	private is_class_node(node: ts.Node): boolean {
		if (ts.isClassDeclaration(node)) {
			return true;
		}
		return ts.isClassExpression(node);
	}

	/** Responsibilities: _top-level class declaration lookup_. **/
	private top_class_indexes(file: string, lines: string[], python: boolean): number[] {
		if (python) {
			return lines
				.map((line, index) => ({ line, index }))
				.filter((item) => {
					if (this.indentation(item.line) !== this.top_level_indentation) {
						return false;
					}
					return this.class_header(item.line);
				})
				.map((item) => item.index);
		}
		const ast = new TypeScriptAstFile(file, lines.join("\n"));
		return ast
			.classes()
			.filter((node) => !node.type_contract && !node.protocol)
			.map((node) => node.start);
	}

	/** Responsibilities: _aggregation nested-class violations source_. **/
	public append_nested_class(
		violations: Violation[],
		file: string,
		lines: string[],
		python: boolean,
		...source_files: ts.SourceFile[]
	): void {
		let indexes: number[];
		if (python) {
			indexes = this.nested_python_classes(lines);
		} else {
			indexes = this.nested_typescript_classes(file, lines, ...source_files);
		}
		if (indexes.length === 0) {
			return;
		}
		const rule = new DiagnosticRule("nested-class");
		violations.push(rule.violation(file, indexes[0] + 1, { count: String(indexes.length) }));
	}

	/** Responsibilities: _output top-level class indexing_. **/
	public class_indexes_for(file: string, lines: string[], python: boolean, ...parsed_lists: number[][]): number[] {
		let parsed_indexes: number[] = [];
		if (parsed_lists[0] !== undefined) {
			parsed_indexes = parsed_lists[0];
		}
		if (parsed_indexes.length > 0) {
			return parsed_indexes;
		}
		return this.top_class_indexes(file, lines, python);
	}
}
