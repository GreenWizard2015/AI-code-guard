import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ModulePathResolver } from "src/protocols";

/** Responsibilities: _AST property source graph_. **/
export class AstPropertySourceGraph {
	private readonly root_source: ts.SourceFile;
	private readonly source_files = new Map<string, ts.SourceFile>();
	public readonly declarations: Map<string, ts.Declaration>;
	private readonly binding_types: Map<string, ts.TypeNode>;
	private readonly binding_aliases: Map<string, string>;
	private readonly prepared_sources = new Set<AstPropertySourceGraph>();
	private readonly module_path: ModulePathResolver;

	/** Responsibilities: _source declaration registration_. **/
	private register_source(source: ts.SourceFile): void {
		const visit = (node: ts.Node): void => {
			this.register_declaration(source, node);
			this.register_binding(source, node);
			ts.forEachChild(node, visit);
		};
		visit(source);
	}

	/** Responsibilities: _declaration registration_. **/
	private register_declaration(source: ts.SourceFile, node: ts.Node): void {
		if (ts.isTypeAliasDeclaration(node)) {
			this.declarations.set(`${source.fileName}\u0000${node.name.text}`, node);
		}
		if (ts.isInterfaceDeclaration(node)) {
			this.declarations.set(`${source.fileName}\u0000${node.name.text}`, node);
		}
	}

	/** Responsibilities: _binding registration_. **/
	private register_binding(source: ts.SourceFile, node: ts.Node): void {
		if (ts.isParameter(node)) {
			this.register_parameter_binding(source, node);
		}
		if (ts.isVariableDeclaration(node)) {
			this.register_variable_binding(source, node);
			this.register_variable_alias(source, node);
		}
	}

	/** Responsibilities: _parameter type registration_. **/
	private register_parameter_binding(source: ts.SourceFile, node: ts.ParameterDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		this.binding_types.set(`${source.fileName}\u0000${node.name.text}`, node.type);
	}

	/** Responsibilities: _variable type registration_. **/
	private register_variable_binding(source: ts.SourceFile, node: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		this.binding_types.set(`${source.fileName}\u0000${node.name.text}`, node.type);
	}

	/** Responsibilities: _variable alias registration_. **/
	private register_variable_alias(source: ts.SourceFile, node: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.initializer === undefined) {
			return;
		}
		const key = `${source.fileName}\u0000${node.name.text}`;
		if (ts.isIdentifier(node.initializer)) {
			this.binding_aliases.set(key, node.initializer.text);
			return;
		}
		this.binding_aliases.delete(key);
	}

	/** Responsibilities: _imported source loading_. **/
	private import_sources(source: ts.SourceFile): void {
		for (const statement of source.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			if (!ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			this.import_statement(source, statement);
		}
	}

	/** Responsibilities: _imported statement loading_. **/
	private import_statement(source: ts.SourceFile, statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const file = this.module_path(source.fileName, statement.moduleSpecifier.text);
		if (file.length === 0) {
			return;
		}
		if (this.source_files.has(file)) {
			return;
		}
		this.load_source(file);
	}

	/** Responsibilities: _imported source registration_. **/
	private load_source(file: string): void {
		const imported = ts.createSourceFile(
			file,
			readFileSync(file, "utf8"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		this.source_files.set(file, imported);
		this.register_source(imported);
		this.import_sources(imported);
	}

	/** Responsibilities: _source graph preparation_. **/
	private prepare_sources(): void {
		if (this.prepared_sources.has(this)) {
			return;
		}
		this.register_source(this.root_source);
		this.import_sources(this.root_source);
		this.prepared_sources.add(this);
	}

	/** Responsibilities: _initialization source graph_. **/
	public constructor(
		root_source: ts.SourceFile,
		declarations: Map<string, ts.Declaration>,
		binding_types: Map<string, ts.TypeNode>,
		binding_aliases: Map<string, string>,
		module_path: ModulePathResolver,
	) {
		this.root_source = root_source;
		this.declarations = declarations;
		this.binding_types = binding_types;
		this.binding_aliases = binding_aliases;
		this.module_path = module_path;
		this.source_files.set(root_source.fileName, root_source);
	}

	/** Responsibilities: _source file lookup_. **/
	public source(file: string): ts.SourceFile {
		const source = this.source_files.get(file);
		if (source !== undefined) {
			return source;
		}
		return this.root_source;
	}

	/** Responsibilities: _binding type resolution_. **/
	public binding_type(file: string, name: string, unknown_type: ts.TypeNode): ts.TypeNode {
		this.prepare_sources();
		let current = name;
		const seen = new Set<string>();
		while (!seen.has(current)) {
			seen.add(current);
			const type = this.binding_types.get(`${file}\u0000${current}`);
			if (type !== undefined) {
				return type;
			}
			const alias = this.binding_aliases.get(`${file}\u0000${current}`);
			if (alias === undefined) {
				break;
			}
			current = alias;
		}
		return unknown_type;
	}
}
