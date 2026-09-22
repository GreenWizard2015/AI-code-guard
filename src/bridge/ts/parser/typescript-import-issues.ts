import ts from 'typescript';
import type { AstImportIssue } from 'src/types';
import type { LineOf } from 'src/bridge/ts/parser/types';
import { IMPORT_KINDS } from 'src/bridge/ts/parser/constants';

/** Responsibilities: _classification TypeScript relative nested_. **/
export class TypeScriptImportIssues {
	private readonly import_kinds = IMPORT_KINDS;

	/** Responsibilities: _classification import usage relative_. **/
	private is_relative_import(node: ts.Node): boolean {
		let module_name: string | undefined;
if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			module_name = node.moduleSpecifier.text;
		} else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
			const expression = node.moduleReference.expression;
			if (ts.isStringLiteral(expression)) {
				module_name = expression.text;
			}
		}
		if (module_name === '.' || module_name === '..') {
			return true;
		}
		if (module_name === undefined) {
			return false;
		}
return module_name.startsWith('./') || module_name.startsWith('../');
	}

	/** Responsibilities: _creation normalization import issues_. **/
	private create_import_issues(
		line: number,
		dynamic: boolean,
		nested: boolean,
		relative: boolean
	): AstImportIssue[] {
		const issues: AstImportIssue[] = [];
		if (dynamic) {
			issues.push({ line, kind: 'dynamic' });
		}
		if (nested) {
			issues.push({ line, kind: 'nested' });
		}
		if (relative) {
			issues.push({ line, kind: 'relative' });
		}
		return issues;
	}

	/** Responsibilities: _classification import nested callable_. **/
	private is_nested_import(node: ts.Node): boolean {
		if (!this.import_kinds.has(node.kind)) {
			return false;
		}
		return !ts.isSourceFile(node.parent);
	}

	/** Responsibilities: _classification node performs dynamic_. **/
	private is_dynamic_import(node: ts.Node): boolean {
		if (ts.isImportTypeNode(node)) {
			return true;
		}
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			return true;
		}
		if (ts.isIdentifier(node.expression)) {
			if (node.expression.text === 'require') {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _collection imports occur after_. **/
	public late_import_issues(source_file: ts.SourceFile, line_of: LineOf): AstImportIssue[] {
		let imports_closed = false;
		const issues: AstImportIssue[] = [];
		for (const statement of source_file.statements) {
			if (this.import_kinds.has(statement.kind)) {
				if (imports_closed) {
					issues.push({
						line: line_of(statement.getStart(source_file)),
						kind: 'late',
					});
				}
				continue;
			}
			imports_closed = true;
		}
		return issues;
	}


	/** Responsibilities: _collection import issues represented_. **/
	public node_import_issues(
		node: ts.Node,
		source_file: ts.SourceFile,
		line_of: LineOf
	): AstImportIssue[] {
		const line = line_of(node.getStart(source_file));
		const dynamic = this.is_dynamic_import(node);
		const nested = this.is_nested_import(node);
		const relative = this.is_relative_import(node);
		return this.create_import_issues(line, dynamic, nested, relative);
	}
}
