import { TestPathSyntax } from 'src/test-path-syntax';
import { TypeScriptImportedFunctionAliases } from 'src/typescript-imported-function-aliases';
import { relative } from 'node:path';
import ts from 'typescript';

import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import { SourceText } from 'src/rules/typescript/default-source-loader';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import type { FieldAssignment, TypeScriptClassFieldContext } from 'src/model/types';
import { VISIBILITY_MODIFIERS } from 'src/model/constants';
import type { LintProjectContext } from 'src/protocols';

/** Responsibilities: _fields and violations inspection_. **/
export class TypeScriptClassFieldRules {
	private readonly source_loader = new SourceText();
	private readonly test_path_syntax = new TestPathSyntax();
	private readonly test_file_cache = new Map<string, boolean>();

	/** Responsibilities: _paths identification testing_. **/
	private test_file(file: string): boolean {
		const cached = this.test_file_cache.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.test_path_syntax.test_file(file);
		this.test_file_cache.set(file, result);
		return result;
	}

	/** Responsibilities: _index top-level functions_. **/
	private file_functions(files: string[]): Map<string, Set<string>> {
		const functions = new Map<string, Set<string>>();
		for (const file of files) {
			const ast = new TypeScriptAstFile(file, this.source_loader.source_text(file));
			functions.set(file, new Set(ast.functions().map(node => node.name)));
		}
		return functions;
	}

	/** Responsibilities: _index contextual functions_. **/
	private context_functions(
		files: readonly string[],
		context: LintProjectContext
	): Map<string, Set<string>> {
		const functions = new Map<string, Set<string>>();
		for (const file of files) {
			const source = context.source_record(file);
			functions.set(file, new Set(source.normalized_ast.functions.map(node => node.name)));
		}
		return functions;
	}

	/** Responsibilities: _imported function fields detection_. **/
	private append_member_violation(
		member: ts.ClassElement,
		context: TypeScriptClassFieldContext,
		violations: Violation[]
	): void {
if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) {
			return;
		}
if (!ts.isIdentifier(member.name) || !ts.isIdentifier(member.initializer)) {
			return;
		}
		const assignment: FieldAssignment = {
			field: member.name.text,
			name: member.initializer.text,
		};
		if (this.references_imported_function(assignment, context)) {
			violations.push(this.field_violation(member, assignment, context));
		}
	}

	/** Responsibilities: _class members inspection_. **/
	private append_members(
		members: readonly ts.ClassElement[],
		context: TypeScriptClassFieldContext,
		violations: Violation[]
	): void {
		for (const member of members) {
			this.append_member_violation(member, context, violations);
		}
	}

	/** Responsibilities: _imported field violations collection_. **/
	private collect_statement(statement: ts.Statement, context: TypeScriptClassFieldContext): Violation[] {
		const violations: Violation[] = [];
		if (ts.isClassDeclaration(statement)) {
			this.append_members(statement.members, context, violations);
			return violations;
		}
		if (!ts.isVariableStatement(statement)) {
			return violations;
		}
		for (const declaration of statement.declarationList.declarations) {
if (declaration.initializer && ts.isClassExpression(declaration.initializer)) {
				this.append_members(declaration.initializer.members, context, violations);
			}
		}
		return violations;
	}

	/** Responsibilities: _field diagnostic creation_. **/
	private field_violation(
		member: ts.ClassElement,
		assignment: FieldAssignment,
		context: TypeScriptClassFieldContext
	): Violation {
		const position = member.getStart(context.source_file);
		const line = context.source_file.getLineAndCharacterOfPosition(position).line + 1;
		const rule = new DiagnosticRule('class-field-import');
		return rule.violation(context.relative_file, line, {
			field: assignment.field,
			name: assignment.name,
		});
	}

	/** Responsibilities: _imported field functions resolution_. **/
	private references_imported_function(assignment: FieldAssignment, context: TypeScriptClassFieldContext): boolean {
		const imported = context.imports.get(assignment.name);
if (imported === undefined || imported.source_file === context.file) {
			return false;
		}
		const source_functions = context.functions.get(imported.source_file);
		if (source_functions === undefined) {
			return false;
		}
		return source_functions.has(imported.source_name);
	}

	/** Responsibilities: _imported function fields scanning_. **/
	private source_fields(
		file: string,
		repo_root: string,
		source_file: ts.SourceFile,
		functions: Map<string, Set<string>>
	): Violation[] {
		const imported_function_aliases = new TypeScriptImportedFunctionAliases();
		if (source_file.statements.length === 0) {
			return [];
		}
		const field_context: TypeScriptClassFieldContext = {
			file,
			relative_file: relative(repo_root, file).split('\\').join('/'),
			source_file: source_file,
			imports: imported_function_aliases.imported_function_aliases(source_file),
			functions,
		};
		return source_file.statements.flatMap(statement =>
			this.collect_statement(statement, field_context)
		);
	}

	/** Responsibilities: _report missing visibility_. **/
	public missing_visibility(node: ts.Node, file: string): boolean {
		if (this.test_file(file)) {
			return false;
		}
		if (!ts.isMethodDeclaration(node) && !ts.isPropertyDeclaration(node)) {
			return false;
		}
		if (!ts.isClassDeclaration(node.parent) && !ts.isClassExpression(node.parent)) {
			return false;
		}
		const modifiers = node.modifiers;
		if (!modifiers) {
			return true;
		}
		return !modifiers.some(modifier => VISIBILITY_MODIFIERS.includes(modifier.kind));
	}

	/** Responsibilities: _report mutable fields_. **/
	public mutable_field(node: ts.Node, file: string): boolean {
		if (this.test_file(file)) {
			return false;
		}
		if (!ts.isPropertyDeclaration(node)) {
			return false;
		}
		const modifiers = node.modifiers;
		if (!modifiers) {
			return true;
		}
		return !modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
	}

	/** Responsibilities: _source field violations collection_. **/
	public collect_fields(
		files: string[],
		repo_root: string
	): Violation[] {
		const source_files = files.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
		const functions = this.file_functions(source_files);
		return source_files.flatMap(file => {
			const ast = new TypeScriptAstFile(file, this.source_loader.source_text(file));
			return this.source_fields(file, repo_root, ast.source_file, functions);
		});
	}

	/** Responsibilities: _contextual field violations collection_. **/
	public context_fields(
		files: string[],
		repo_root: string,
		context: LintProjectContext
	): Violation[] {
		const source_files = files.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
		const functions = this.context_functions(source_files, context);
		return source_files.flatMap(file => {
			const source = context.source_record(file);
			if (!source.typescript()) {
				return [];
			}
			return this.source_fields(
				file,
				repo_root,
				source.typescript_ast.source_file,
				functions
			);
		});
	}
}
