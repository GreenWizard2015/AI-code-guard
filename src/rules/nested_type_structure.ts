import ts from "typescript";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";
import type { NamedLine } from "src/types";

/** Responsibilities: _nested type discovery_, _nested declaration diagnostics_. **/
export class NestedTypeStructure {
	private readonly nested_scope_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _classification nested type scope_. **/
	private nested_scope(node: ts.Node): boolean {
		if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
			return true;
		}
		return this.nested_scope_kinds.has(node.kind);
	}

	/** Responsibilities: _nested TypeScript type collection_. **/
	private nested_type_indexes(source_file: ts.SourceFile): number[] {
		const indexes: number[] = [];
		const visit = (node: ts.Node, nested: boolean): void => {
			let type_declaration = ts.isTypeAliasDeclaration(node);
			if (!type_declaration) {
				type_declaration = ts.isInterfaceDeclaration(node);
			}
			if (!type_declaration) {
				type_declaration = ts.isEnumDeclaration(node);
			}
			if (type_declaration) {
				if (nested) {
					indexes.push(source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line);
				}
			}
			let child_nested = nested;
			if (this.nested_scope(node)) {
				child_nested = true;
			}
			ts.forEachChild(node, (child) => visit(child, child_nested));
		};
		visit(source_file, false);
		return indexes;
	}

	/** Responsibilities: _source indentation measurement_. **/
	private indentation(line: string): number {
		let index = 0;
		while (index < line.length && (line[index] === " " || line[index] === "\t")) {
			index += 1;
		}
		return index;
	}

	/** Responsibilities: _nested Python type collection_. **/
	private python_type_indexes(lines: readonly string[], declarations: readonly NamedLine[]): number[] {
		return declarations
			.filter((declaration) => {
				let line = "";
				if (lines[declaration.line] !== undefined) {
					line = lines[declaration.line];
				}
				const code = line.slice(this.indentation(line));
				if (this.indentation(line) === 0) {
					return false;
				}
				return !code.startsWith("class ");
			})
			.map((declaration) => declaration.line);
	}

	/** Responsibilities: _nested type diagnostic creation_. **/
	private append_violation(violations: ViolationContract[], file: string, indexes: readonly number[]): void {
		if (indexes.length === 0) {
			return;
		}
		const rule = new DiagnosticRule("nested-type");
		violations.push(rule.violation(file, indexes[0] + 1, { count: String(indexes.length) }));
	}

	/** Responsibilities: _nested TypeScript type diagnostics_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.nested_scope_kinds = new Set([
			ts.SyntaxKind.ModuleBlock,
			ts.SyntaxKind.Block,
			ts.SyntaxKind.ObjectLiteralExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
			ts.SyntaxKind.CaseBlock,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public append_nested_types(violations: ViolationContract[], file: string, source_file: ts.SourceFile): void {
		const indexes = this.nested_type_indexes(source_file);
		this.append_violation(violations, file, indexes);
	}

	/** Responsibilities: _nested Python type diagnostics_. **/
	public append_python_types(
		violations: ViolationContract[],
		file: string,
		lines: readonly string[],
		declarations: readonly NamedLine[],
	): void {
		const indexes = this.python_type_indexes(lines, declarations);
		if (indexes.length === 0) {
			return;
		}
		const rule = new DiagnosticRule("nested-type");
		violations.push(rule.violation(file, indexes[0] + 1, { count: String(indexes.length) }));
	}
}
