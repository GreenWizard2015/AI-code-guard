import { TestPathSyntax } from 'src/test-path-syntax';
import ts from 'typescript';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { TypeScriptAstFile } from 'src/model/typescript-ast';


/** Responsibilities: _top-level nested Python lookup_. **/
export class ClassStructure {
	private readonly top_level_indentation = 0;

	/** Responsibilities: _nested Python class lookup_. **/
	private nested_python_classes(lines: string[]): number[] {
		const test_path_syntax = new TestPathSyntax();

		const indexes: number[] = [];
		for (const [index, line] of lines.entries()) {
			if (test_path_syntax.indentation(line) > this.top_level_indentation) {
				if (test_path_syntax.class_header(line)) {
					indexes.push(index);
				}
			}
		}
		return indexes;
	}

	/** Responsibilities: _selection parsing TypeScript source_. **/
	private typescript_source_file(file: string, lines: string[], ...source_files: ts.SourceFile[]): ts.SourceFile {
		if (source_files.length === 0) {
			return new TypeScriptAstFile(file, lines.join('\n')).source_file;
		}
		return source_files[0];
	}

	/** Responsibilities: _nested TypeScript class lookup_. **/
	private nested_typescript_classes(file: string, lines: string[], ...source_files: ts.SourceFile[]): number[] {
		const source_file = this.typescript_source_file(file, lines, ...source_files);
		const indexes: number[] = [];
		const visit = (node: ts.Node, inside_class: boolean): void => {
			const is_class = this.is_class_node(node);
			if (is_class) {
				if (inside_class) {
					indexes.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line);
				}
			}
			let child_inside_class = inside_class;
			if (is_class) {
				child_inside_class = true;
			}
			ts.forEachChild(node, child => visit(child, child_inside_class));
		};
		visit(source_file, false);
		return indexes;
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
		const test_path_syntax = new TestPathSyntax();

		if (python) {
			return lines
				.map((line, index) => ({ line, index }))
				.filter(
					item =>
						test_path_syntax.indentation(item.line) === this.top_level_indentation &&
						test_path_syntax.class_header(item.line)
				)
				.map(item => item.index);
		}
		const ast = new TypeScriptAstFile(file, lines.join('\n'));
		return ast
			.classes()
			.filter(node => !node.type_contract && !node.protocol)
			.map(node => node.start);
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
		const rule = new DiagnosticRule('nested-class');
		violations.push(rule.violation(file, indexes[0] + 1, { count: String(indexes.length) }));
	}

	/** Responsibilities: _output top-level class indexing_. **/
	public class_indexes_for(
		file: string,
		lines: string[],
		python: boolean,
		...parsed_lists: number[][]
	): number[] {
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
