import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import ts from 'typescript';
import { AstNamespaceTypeImports } from 'src/bridge/ts/rules/ast-property-sources/ast-namespace-type-imports';
import { AstPropertySourceGraph } from 'src/bridge/ts/rules/ast-property-sources/ast-property-source-graph';

/** Responsibilities: _AST property source resolution_. **/
export class AstPropertySources {
	private readonly declarations = new Map<string, ts.Declaration>();
	private readonly binding_types = new Map<string, ts.TypeNode>();
	private readonly binding_aliases = new Map<string, string>();
	private readonly unknown_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
	private readonly graph: AstPropertySourceGraph;
	private readonly namespace_imports: AstNamespaceTypeImports;

	/** Responsibilities: _project root lookup_. **/
	private project_root(file: string): string {
		let directory = dirname(file);
		while (directory !== dirname(directory)) {
			if (existsSync(join(directory, 'tsconfig.json'))) {
				return directory;
			}
			directory = dirname(directory);
		}
		return dirname(file);
	}

	/** Responsibilities: _import base path resolution_. **/
	private base_path(file: string, specifier: string): string {
		if (specifier.startsWith('.')) {
			return join(dirname(file), specifier);
		}
		if (specifier.startsWith('src/')) {
			return join(this.project_root(file), specifier);
		}
		return '';
	}

	/** Responsibilities: _imported declaration key_. **/
	private imported_key(source: ts.SourceFile, name: string): string {
		for (const statement of source.statements) {
			const module_name = this.import_module(statement);
			if (module_name.length === 0) {
				continue;
			}
			for (const element of this.import_elements(statement)) {
				let imported_name = element.name.text;
				if (element.propertyName !== undefined) {
					imported_name = element.propertyName.text;
				}
				if (element.name.text === name) {
					return `${this.module_path(source.fileName, module_name)}\u0000${imported_name}`;
				}
			}
		}
		return '';
	}

	/** Responsibilities: _import module specifier_. **/
	private import_module(statement: ts.Statement): string {
		if (!ts.isImportDeclaration(statement)) {
			return '';
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return '';
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
	public constructor(source_file: ts.SourceFile) {
		this.graph = new AstPropertySourceGraph(
			source_file,
			this.declarations,
			this.binding_types,
			this.binding_aliases,
			(this_file, specifier) => this.module_path(this_file, specifier),
		);
		this.namespace_imports = new AstNamespaceTypeImports(source_file, this);
	}

	/** Responsibilities: _imported module path_. **/
	public module_path(file: string, specifier: string): string {
		const base = this.base_path(file, specifier);
		if (base.length === 0) {
			return '';
		}
		if (extname(base).length > 0) {
			if (existsSync(base)) {
				return base;
			}
		}
		for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		return '';
	}

	/** Responsibilities: _declaration key resolution_. **/
	public declaration_key(file: string, name: string): string {
		const local_key = `${file}\u0000${name}`;
		if (this.graph.declarations.has(local_key)) {
			return local_key;
		}
		const namespace_key = this.namespace_imports.key(name);
		if (namespace_key.length > 0) {
			return namespace_key;
		}
		return this.imported_key(this.graph.source(file), name);
	}

	/** Responsibilities: _binding type resolution_. **/
	public binding_type(file: string, name: string): ts.TypeNode {
		return this.graph.binding_type(file, name, this.unknown_type);
	}

	/** Responsibilities: _checking declaration availability_. **/
	public declaration_exists(key: string): boolean {
		if (!key.includes('\u0000')) {
			return false;
		}
		const declaration = this.graph.declarations.get(key);
		if (declaration === undefined) {
			return false;
		}
		if (ts.isTypeAliasDeclaration(declaration)) {
			return true;
		}
		return ts.isInterfaceDeclaration(declaration);
	}

	/** Responsibilities: _retrieving declarations_. **/
	public declaration(key: string): ts.Declaration {
		if (!key.includes('\u0000')) {
			throw new Error(`Invalid AST property declaration key: ${key}`);
		}
		const declaration = this.graph.declarations.get(key);
		if (declaration === undefined) {
			throw new Error(`AST property declaration is unavailable: ${key}`);
		}
		return declaration;
	}
}
