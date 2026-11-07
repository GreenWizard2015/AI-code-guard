import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { AstNamespaceTypeImports } from "src/rules/typescript/syntax-rules/ast/ast_namespace_type_imports";
import { AstPropertySourceGraph } from "src/rules/typescript/syntax-rules/ast/ast_property_source_graph";
import type { AstPropertySourceGraphContract, AstPropertySourceIndexContract } from "src/source_protocols";
import type { AstNamespaceTypeImportsContract, AstPropertySourcesContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _declaration sources_, _import sources_. **/
export class AstPropertySources implements AstPropertySourcesContract {
	private readonly _declarations: Map<string, ts.Declaration>;
	private readonly _unknown_type: ts.KeywordTypeNode;
	private readonly _graph: AstPropertySourceGraphContract;
	private readonly _namespace_imports: AstNamespaceTypeImportsContract;
	private readonly _module_exports: TypeScriptPropertyModuleResolverContract;

	/** Responsibilities: _imported declaration key_. **/
	private element_name(element: ts.ImportSpecifier): string {
		if (element.propertyName === undefined) {
			return element.name.text;
		}
		return element.propertyName.text;
	}

	/** Responsibilities: _statement declaration key_. **/
	private resolved_key(resolution_source: ts.SourceFile, module_name: string, imported_name: string): string {
		const module = this._module_exports.module_symbol(resolution_source.fileName, module_name);
		const resolved = this._module_exports.resolve({ file: module, name: imported_name });
		if (resolved.file.length === 0) {
			return "";
		}
		return `${resolved.file}\u0000${resolved.name}`;
	}

	/** Responsibilities: _statement declaration key_. **/
	private statement_key(statement_source: ts.SourceFile, import_statement: ts.Statement, local_name: string): string {
		const module_name = this.import_module(import_statement);
		if (module_name.length === 0) {
			return "";
		}
		for (const element of this.import_elements(import_statement)) {
			const imported_name = this.element_name(element);
			if (element.name.text !== local_name) {
				continue;
			}
			return this.resolved_key(statement_source, module_name, imported_name);
		}
		return "";
	}

	/** Responsibilities: _imported declaration key_. **/
	private imported_key(import_source: ts.SourceFile, imported_local_name: string): string {
		for (const import_statement of import_source.statements) {
			const key = this.statement_key(import_source, import_statement, imported_local_name);
			if (key.length > 0) {
				return key;
			}
		}
		return "";
	}

	/** Responsibilities: _import module specifier_. **/
	private import_module(statement: ts.Statement): string {
		if (!ts.isImportDeclaration(statement)) {
			return "";
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		return statement.moduleSpecifier.text;
	}

	/** Responsibilities: _named import elements_. **/
	private import_elements(statement: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		const clause = statement.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return [];
		}
		return clause.namedBindings.elements;
	}

	/** Responsibilities: _initialization AST property sources_. **/
	public constructor(
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolver,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this._unknown_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
		this._declarations = new Map<string, ts.Declaration>();
		this._module_exports = module_exports;
		this._graph = new AstPropertySourceGraph(
			source_file,
			this._declarations,
			this._module_exports,
			source_resolver,
			source_index,
		);
		this._namespace_imports = new AstNamespaceTypeImports(source_file, this._module_exports);
	}

	/** Responsibilities: _declaration key resolution_. **/
	public declaration_key(file: string, name: string): string {
		const local_key = `${file}\u0000${name}`;
		if (this._graph.declaration(local_key).found()) {
			return local_key;
		}
		const namespace_key = this._namespace_imports.key(name);
		if (namespace_key.length > 0) {
			return namespace_key;
		}
		return this.imported_key(this._graph.source(file), name);
	}

	/** Responsibilities: _binding type resolution_. **/
	public binding_type(identifier: ts.Identifier): ts.TypeNode {
		return this._graph.binding_type(identifier, this._unknown_type);
	}

	/** Responsibilities: _checking declaration availability_. **/
	public declaration_exists(key: string): boolean {
		if (!key.includes("\u0000")) {
			return false;
		}
		const declaration = this._graph.declaration(key);
		if (!declaration.found()) {
			return false;
		}
		if (declaration.type_alias()) {
			return true;
		}
		return declaration.interface();
	}

	/** Responsibilities: _retrieving declarations_. **/
	public declaration(key: string): ts.Declaration {
		if (!key.includes("\u0000")) {
			throw new Error(`Invalid AST property declaration key: ${key}`);
		}
		const declaration = this._graph.declaration(key);
		if (!declaration.found()) {
			throw new Error(`AST property declaration is unavailable: ${key}`);
		}
		return declaration.value();
	}
}
