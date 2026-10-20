import { TestPathSyntax } from "src/test_path_syntax";
import { TypeScriptImportedFunctionAliases } from "src/model/type_script_imported_function_aliases";
import type { TypeScriptImportedFunctionAliasesContract } from "src/typescript_analysis_types";
import { relative } from "node:path";
import ts from "typescript";

import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { StringSetMap } from "src/analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptClassFieldRulesContract } from "src/typescript_analysis_protocols";
import { SourceText } from "src/source_text";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { FieldAssignment, TypeScriptClassFieldContext } from "src/model/types";
import { VISIBILITY_MODIFIERS } from "src/constants";
import type { LintProjectContextContract } from "src/shared_services_protocols";

/** Responsibilities: _field visibility validation_, _field assignment analysis_. **/
export class TypeScriptClassFieldRules implements TypeScriptClassFieldRulesContract {
	private readonly source_loader: SourceText;
	private readonly test_path_syntax: TestPathSyntax;
	private readonly test_file_cache: Map<string, boolean>;

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
	private file_functions(files: string[]): StringSetMap {
		const functions: StringSetMap = new Map();
		for (const file of files) {
			const ast = new TypeScriptAstFile(file, this.source_loader.source_text(file));
			functions.set(file, new Set(ast.functions().map((node) => node.name)));
		}
		return functions;
	}

	/** Responsibilities: _index contextual functions_. **/
	private context_functions(files: readonly string[], context: LintProjectContextContract): StringSetMap {
		const functions: StringSetMap = new Map();
		for (const file of files) {
			const source = context.source_record(file);
			functions.set(file, new Set(source.normalized_ast.functions.map((node) => node.name)));
		}
		return functions;
	}

	/** Responsibilities: _contextual import alias index_. **/
	private context_function_aliases(
		repo_root: string,
		context: LintProjectContextContract,
	): TypeScriptImportedFunctionAliasesContract {
		const shared_source_files = new Map(
			context
				.files()
				.filter((source) => source.typescript())
				.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
		);
		return new TypeScriptImportedFunctionAliases(repo_root, shared_source_files, false, context.source_io);
	}

	/** Responsibilities: _contextual field collection_. **/
	private context_file_fields(
		file: string,
		repo_root: string,
		context: LintProjectContextContract,
		functions: StringSetMap,
		imported_function_aliases: TypeScriptImportedFunctionAliasesContract,
	): ViolationContract[] {
		const source = context.source_record(file);
		if (!source.typescript()) {
			return [];
		}
		return this.source_fields(
			file,
			repo_root,
			source.typescript_ast.source_file_node(),
			functions,
			imported_function_aliases,
		);
	}

	/** Responsibilities: _field diagnostic creation_. **/
	private field_violation(
		member: ts.ClassElement,
		assignment: FieldAssignment,
		context: TypeScriptClassFieldContext,
	): ViolationContract {
		const position = member.getStart(context.source_file);
		const line = context.source_file.getLineAndCharacterOfPosition(position).line + 1;
		const rule = new DiagnosticRule("class-field-import");
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

	/** Responsibilities: _imported function fields detection_. **/
	private append_member_violation(
		member: ts.ClassElement,
		context: TypeScriptClassFieldContext,
		violations: ViolationContract[],
	): void {
		if (!ts.isPropertyDeclaration(member)) {
			return;
		}
		if (member.initializer === undefined) {
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
		violations: ViolationContract[],
	): void {
		for (const member of members) {
			this.append_member_violation(member, context, violations);
		}
	}

	/** Responsibilities: _nested class field collection_. **/
	private collect_node(node: ts.Node, context: TypeScriptClassFieldContext): ViolationContract[] {
		const violations: ViolationContract[] = [];
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			this.append_members(node.members, context, violations);
		}
		node.forEachChild((child) => {
			violations.push(...this.collect_node(child, context));
		});
		return violations;
	}

	/** Responsibilities: _imported function fields scanning_. **/
	private source_fields(
		file: string,
		repo_root: string,
		source_file: ts.SourceFile,
		functions: StringSetMap,
		imported_function_aliases: TypeScriptImportedFunctionAliasesContract,
	): ViolationContract[] {
		if (source_file.statements.length === 0) {
			return [];
		}
		const field_context: TypeScriptClassFieldContext = {
			file,
			relative_file: relative(repo_root, file).split("\\").join("/"),
			source_file: source_file,
			imports: imported_function_aliases.imported_function_aliases(source_file),
			functions,
		};
		if (imported_function_aliases.imported_function_names(field_context.imports).size === 0) {
			return [];
		}
		return this.collect_node(source_file, field_context);
	}

	/** Responsibilities: _report missing visibility_. **/
	private visibility_member(node: ts.Node): boolean {
		if (ts.isMethodDeclaration(node)) {
			return true;
		}
		if (ts.isPropertyDeclaration(node)) {
			return true;
		}
		if (ts.isGetAccessor(node)) {
			return true;
		}
		return ts.isSetAccessor(node);
	}

	/** Responsibilities: _member modifier resolution_. **/
	private modifiers(node: ts.Node): readonly ts.Modifier[] {
		if (!ts.canHaveModifiers(node)) {
			return [];
		}
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return [];
		}
		return modifiers;
	}

	/** Responsibilities: _report missing visibility_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.source_loader = new SourceText();
		this.test_path_syntax = new TestPathSyntax();
		this.test_file_cache = new Map<string, boolean>();
	}
	/** Responsibilities: _public operation_. **/
	public missing_visibility(node: ts.Node, file: string): boolean {
		if (this.test_file(file)) {
			return false;
		}
		if (!this.visibility_member(node)) {
			return false;
		}
		if (!ts.isClassDeclaration(node.parent) && !ts.isClassExpression(node.parent)) {
			return false;
		}
		const modifiers = this.modifiers(node);
		if (modifiers.length === 0) {
			return true;
		}
		return !modifiers.some((modifier) => VISIBILITY_MODIFIERS.includes(modifier.kind));
	}

	/** Responsibilities: _report mutable fields_. **/
	public mutable_field(node: ts.Node, file: string): boolean {
		if (this.test_file(file)) {
			return false;
		}
		if (!ts.isPropertyDeclaration(node)) {
			return false;
		}
		const modifiers = this.modifiers(node);
		if (modifiers.length === 0) {
			return true;
		}
		return !modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
	}

	/** Responsibilities: _source field violations collection_. **/
	public collect_fields(files: string[], repo_root: string): ViolationContract[] {
		const unique_files = [...new Set(files)];
		const source_files = unique_files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
		const functions = this.file_functions(source_files);
		const imported_function_aliases = new TypeScriptImportedFunctionAliases(
			repo_root,
			new Map(),
			true,
			this.source_loader,
		);
		return source_files.flatMap((file) => {
			const ast = new TypeScriptAstFile(file, this.source_loader.source_text(file));
			return this.source_fields(file, repo_root, ast.source_file, functions, imported_function_aliases);
		});
	}

	/** Responsibilities: _contextual field violations collection_. **/
	public context_fields(files: string[], repo_root: string, context: LintProjectContextContract): ViolationContract[] {
		const unique_files = [...new Set(files)];
		const source_files = unique_files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
		const functions = this.context_functions(source_files, context);
		const imported_function_aliases = this.context_function_aliases(repo_root, context);
		return source_files.flatMap((file) =>
			this.context_file_fields(file, repo_root, context, functions, imported_function_aliases),
		);
	}
}
