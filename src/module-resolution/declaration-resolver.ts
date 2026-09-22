import ts from 'typescript';
import type { RecursiveExportResolver, ResolvedTypeScriptExport } from 'src/module-resolution/types';
import type { TypeScriptDeclarations } from 'src/module-resolution/protocols';

/** Responsibilities: _resolution direct default export-assignment_. **/
export class TypeScriptDeclarationTable implements TypeScriptDeclarations {
	private readonly declaration_kinds = new Set([
		ts.SyntaxKind.InterfaceDeclaration,
		ts.SyntaxKind.TypeAliasDeclaration,
		ts.SyntaxKind.EnumDeclaration,
	]);
	/** Responsibilities: _requested statement classification_. **/
	private has_modifier(statement: ts.Statement, kind: ts.SyntaxKind): boolean {
		if (!ts.canHaveModifiers(statement)) {
			return false;
		}
		const modifiers = ts.getModifiers(statement);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some(modifier => modifier.kind === kind);
	}

	/** Responsibilities: _classification statement declares requested_. **/
	private declaration_name(statement: ts.Statement, name: string): boolean {
if (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) {
			return statement.name?.text === name;
		}
		if (this.declaration_kinds.has(statement.kind)) {
if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
				return statement.name.text === name;
			}
			if (ts.isEnumDeclaration(statement)) {
				return statement.name.text === name;
			}
		}
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		return statement.declarationList.declarations.some(
			declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name
		);
	}

	/** Responsibilities: _resolution named declaration source_. **/
	private named_declaration(
		file: string,
		statement: ts.Statement
	): ResolvedTypeScriptExport {
if (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) {
			if (statement.name === undefined) {
				return { file, name: 'default' };
			}
			return { file, name: statement.name.text };
		}
		if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
			return { file, name: statement.name.text };
		}
		if (ts.isEnumDeclaration(statement)) {
			return { file, name: statement.name.text };
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution direct named declaration_. **/
	public direct_declaration(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		require_export: boolean
	): ResolvedTypeScriptExport {
		for (const statement of source_file.statements) {
			if (!this.declaration_name(statement, name)) {
				continue;
			}
if (!require_export || this.has_modifier(statement, ts.SyntaxKind.ExportKeyword)) {
				return { file, name };
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution default export declaration_. **/
	public default_declaration(
		file: string,
		source_file: ts.SourceFile,
		name: string
	): ResolvedTypeScriptExport {
		if (name !== 'default') {
			return { file: '', name: '' };
		}
		for (const statement of source_file.statements) {
			if (!this.has_modifier(statement, ts.SyntaxKind.DefaultKeyword)) {
				continue;
			}
			const declaration = this.named_declaration(file, statement);
			if (declaration.file.length > 0) {
				return declaration;
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution declaration referenced export_. **/
	public export_assignment(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
		resolver: RecursiveExportResolver
	): ResolvedTypeScriptExport {
		if (name !== 'default') {
			return { file: '', name: '' };
		}
		for (const statement of source_file.statements) {
			if (!ts.isExportAssignment(statement)) {
				continue;
			}
			if (ts.isIdentifier(statement.expression)) {
				return resolver.local_symbol(file, source_file, statement.expression.text, visited);
			}
			return { file, name: 'default' };
		}
		return { file: '', name: '' };
	}
}
