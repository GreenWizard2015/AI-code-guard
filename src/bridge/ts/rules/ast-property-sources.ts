import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import ts from 'typescript';

/** Responsibilities: _resolution AST property sources_. **/
export class AstPropertySources {
	private readonly root_source: ts.SourceFile;
	private readonly source_files = new Map<string, ts.SourceFile>();
	private readonly declarations = new Map<string, ts.Declaration>();
	private readonly binding_types = new Map<string, ts.TypeNode>();
	private readonly unknown_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
	private readonly prepared_sources = new Set<AstPropertySources>();

	/** Responsibilities: _root lookup projection_. **/
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

	/** Responsibilities: _resolution import base path_. **/
	private base_path(file: string, specifier: string): string {
		let base = '';
		if (specifier.startsWith('.')) {
			base = join(dirname(file), specifier);
		} else if (specifier.startsWith('src/')) {
			base = join(this.project_root(file), specifier);
		}
		return base;
	}

	/** Responsibilities: _resolution imported module path_. **/
	private module_path(file: string, specifier: string): string {
		const base = this.base_path(file, specifier);
		if (base.length === 0) {
			return '';
		}
		if (extname(base).length > 0 && existsSync(base)) {
			return base;
		}
		for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		return '';
	}

	/** Responsibilities: _declarations binding types registration_. **/
	private register_source(source: ts.SourceFile): void {
		for (const statement of source.statements) {
if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
				this.declarations.set(`${source.fileName}\u0000${statement.name.text}`, statement);
			}
		}
		const visit = (node: ts.Node): void => {
			if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
				if (ts.isIdentifier(node.name) && node.type !== undefined) {
					this.binding_types.set(`${source.fileName}\u0000${node.name.text}`, node.type);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}

	/** Responsibilities: _imported source files loading_. **/
	private import_sources(source: ts.SourceFile): void {
		for (const statement of source.statements) {
if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const file = this.module_path(source.fileName, statement.moduleSpecifier.text);
			if (file.length === 0) {
				continue;
			}
			if (this.source_files.has(file)) {
				continue;
			}
			const imported = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
			this.source_files.set(file, imported);
			this.register_source(imported);
			this.import_sources(imported);
		}
	}

	/** Responsibilities: _resolution imported declaration key_. **/
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

	/** Responsibilities: _import module specifier reading_. **/
	private import_module(statement: ts.Statement): string {
if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return '';
		}
		return statement.moduleSpecifier.text;
	}

	/** Responsibilities: _named import elements collection_. **/
	private import_elements(statement: ts.Statement): readonly ts.ImportSpecifier[] {
if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
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

	/** Responsibilities: _source graph preparation_. **/
	private prepare(): void {
		if (this.prepared_sources.has(this)) {
			return;
		}
		const source = this.root_source;
		this.register_source(source);
		this.import_sources(source);
		this.prepared_sources.add(this);
	}

	/** Responsibilities: _source file selection_. **/
	private source(file: string): ts.SourceFile {
		const source = this.source_files.get(file);
		if (source !== undefined) {
			return source;
		}
		return this.root_source;
	}

	/** Responsibilities: _initialization AST property source_. **/
	public constructor(source_file: ts.SourceFile) {
		this.root_source = source_file;
		this.source_files.set(source_file.fileName, source_file);
	}

	/** Responsibilities: _binding type resolution_. **/
	public binding_type(file: string, name: string): ts.TypeNode {
		this.prepare();
		const type = this.binding_types.get(`${file}\u0000${name}`);
		if (type !== undefined) {
			return type;
		}
		return this.unknown_type;
	}

	/** Responsibilities: _resolution declaration type key_. **/
	public type_key(file: string, name: string): string {
		this.prepare();
		const local_key = `${file}\u0000${name}`;
		if (this.declarations.has(local_key)) {
			return local_key;
		}
		return this.imported_key(this.source(file), name);
	}

	/** Responsibilities: _available declaration identification_. **/
	public declaration_exists(key: string): boolean {
		if (!key.includes('\u0000')) {
			return false;
		}
		const declaration = this.declarations.get(key);
		if (declaration === undefined) {
			return false;
		}
		return ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration);
	}

	/** Responsibilities: _output resolution declaration_. **/
	public declaration(key: string): ts.Declaration {
		if (!key.includes('\u0000')) {
			throw new Error(`Invalid AST property declaration key: ${key}`);
		}
		const declaration = this.declarations.get(key);
		if (declaration === undefined) {
			throw new Error(`AST property declaration is unavailable: ${key}`);
		}
		return declaration;
	}
}
