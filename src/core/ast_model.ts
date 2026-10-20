import ts from "typescript";
import type { AstClassNode, AstLanguage, NormalizedAstFile } from "src/types";
import type { AstModelContract } from "src/source_protocols";
import type { TypeScriptScannerModuleScope } from "src/model/types/types";

/** Responsibilities: _class inheritance metadata normalization_, _empty AST files creation_. **/
export class AstModel implements AstModelContract {
	private readonly base_name_precedence = ["base_class_names", "base_class_name"] as const;

	/** Responsibilities: _resolution class base-name value_. **/
	private base_name_value(node: AstClassNode, key: (typeof this.base_name_precedence)[number]): string[] {
		const value = node[key];
		if (Array.isArray(value)) {
			if (value.length > 0) {
				return value;
			}
		}
		if (typeof value === "string" && value.length > 0) {
			return [value];
		}
		return [];
	}

	/** Responsibilities: _resolution class base names_. **/
	private base_names(node: AstClassNode): string[] {
		for (const key of this.base_name_precedence) {
			const names = this.base_name_value(node, key);
			if (names.length > 0) {
				return names;
			}
		}
		return [];
	}

	/** Responsibilities: _qualified namespace base addition_. **/
	private append_namespace_base(
		bindings: Set<string>,
		module_path: string,
		namespace: string,
		base: string,
		scope: TypeScriptScannerModuleScope,
	): void {
		const prefix = `${namespace}.`;
		if (!base.startsWith(prefix)) {
			return;
		}
		const exported_name = base.slice(prefix.length);
		const resolved = scope.module_resolver.resolve(module_path, exported_name);
		if (resolved.file.length === 0) {
			return;
		}
		if (scope.project_files.has(resolved.file)) {
			bindings.add(base);
		}
	}

	/** Responsibilities: _qualified namespace class bases_. **/
	private append_class_bases(
		bindings: Set<string>,
		module_path: string,
		namespace: string,
		classes: readonly AstClassNode[],
		scope: TypeScriptScannerModuleScope,
	): void {
		for (const class_node of classes) {
			for (const base of [...class_node.base_class_names, class_node.base_class_name]) {
				this.append_namespace_base(bindings, module_path, namespace, base, scope);
			}
		}
	}

	/** Responsibilities: _project import binding classification_. **/
	private project_import(module_path: string, name: string, scope: TypeScriptScannerModuleScope): boolean {
		if (module_path.length === 0) {
			return false;
		}
		const resolved = scope.module_resolver.resolve(module_path, name);
		if (resolved.file.length === 0) {
			return false;
		}
		return scope.project_files.has(resolved.file);
	}

	/** Responsibilities: _external import alias removal_. **/
	private remove_external_bindings(
		project_names: Set<string>,
		module_path: string,
		named: ts.NamedImportBindings,
		scope: TypeScriptScannerModuleScope,
	): void {
		if (ts.isNamespaceImport(named)) {
			if (!scope.project_files.has(module_path)) {
				project_names.delete(named.name.text);
			}
			return;
		}
		for (const element of named.elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			if (!this.project_import(module_path, imported_name, scope)) {
				project_names.delete(element.name.text);
			}
		}
	}

	/** Responsibilities: _external import exclusion_. **/
	private exclude_import(
		project_names: Set<string>,
		source_file: ts.SourceFile,
		statement: ts.ImportDeclaration,
		scope: TypeScriptScannerModuleScope,
	): void {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		const module_path = scope.module_resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (clause.name !== undefined) {
			if (!this.project_import(module_path, "default", scope)) {
				project_names.delete(clause.name.text);
			}
		}
		if (clause.namedBindings !== undefined) {
			this.remove_external_bindings(project_names, module_path, clause.namedBindings, scope);
		}
	}

	/** Responsibilities: _marking bases outside project_. **/
	public mark_external_bases(classes: AstClassNode[], project_class_names: ReadonlySet<string>): void {
		for (const class_node of classes) {
			class_node.extends_external_class = this.base_names(class_node).some(
				(base) => !project_class_names.has(base),
			);
		}
	}

	/** Responsibilities: _namespace base binding collection_. **/
	public append_namespace_bases(
		bindings: Set<string>,
		source_file: ts.SourceFile,
		classes: readonly AstClassNode[],
		scope: TypeScriptScannerModuleScope,
	): void {
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const named = statement.importClause?.namedBindings;
			if (named === undefined) {
				continue;
			}
			if (!ts.isNamespaceImport(named)) {
				continue;
			}
			const module_path = scope.module_resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
			if (scope.project_files.has(module_path)) {
				this.append_class_bases(bindings, module_path, named.name.text, classes, scope);
			}
		}
	}

	/** Responsibilities: _external import alias exclusion_. **/
	public exclude_external_imports(
		project_names: Set<string>,
		source_file: ts.SourceFile,
		scope: TypeScriptScannerModuleScope,
	): void {
		for (const statement of source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			this.exclude_import(project_names, source_file, statement, scope);
		}
	}

	/** Responsibilities: _creation empty normalization AST_. **/
	public empty_ast_file(language: AstLanguage): NormalizedAstFile {
		return {
			language,
			classes: [],
			functions: [],
			parse_issues: [],
			import_issues: [],
			attribute_accesses: [],
			symbol_references: [],
			literal_references: [],
			literal_constants: [],
			private_accesses: [],
			repeated_branches: [],
			call_references: [],
			module_constant_spans: [],
			module_type_spans: [],
			module_protocol_spans: [],
			named_symbols: [],
			type_declarations: [],
			reference_aliases: [],
			module_instances: [],
			type_members: new Map(),
			coding_issues: [],
			python_imports: [],
			python_callable_count: { count: 0, first_line: 0 },
			python_main_guard: false,
			docstring_spans: [],
			responsibility_targets: [],
		};
	}
}
