import ts from "typescript";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import type {
	AstPropertyBindingResolverContract,
	AstPropertySourceGraphContract,
	AstPropertySourceIndexContract,
	SourceFileResolver,
} from "src/protocols";
import { AstDeclarationLookup } from "src/rules/typescript/syntax-rules/ast/ast_declaration_lookup";
import type { AstDeclarationLookupContract } from "src/protocols";

/** Responsibilities: _imported declaration graph assembly_, _re-export traversal_. **/
export class AstPropertySourceGraph implements AstPropertySourceGraphContract {
	private readonly root_source: ts.SourceFile;
	private readonly source_files: Map<string, ts.SourceFile>;
	private readonly declaration_map: Map<string, ts.Declaration>;
	private readonly bindings: AstPropertyBindingResolverContract;
	private readonly prepared_graphs: Set<AstPropertySourceGraph>;
	private readonly module_path: TypeScriptPropertyModuleResolverContract;
	private readonly source_resolver: SourceFileResolver;
	private readonly source_index: AstPropertySourceIndexContract;

	/** Responsibilities: _source declaration registration_. **/
	private register_source(source: ts.SourceFile): void {
		for (const [key, declaration] of this.source_index.declarations_for(source)) {
			this.declaration_map.set(key, declaration);
		}
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
		this.export_sources(source);
	}

	/** Responsibilities: _re-export source loading_. **/
	private export_sources(source: ts.SourceFile): void {
		for (const statement of source.statements) {
			this.export_statement(source, statement);
		}
	}

	/** Responsibilities: _re-export declaration registration_. **/
	private export_file(source: ts.SourceFile, statement: ts.Statement): string {
		if (!ts.isExportDeclaration(statement)) {
			return "";
		}
		const specifier = statement.moduleSpecifier;
		if (specifier === undefined) {
			return "";
		}
		if (!ts.isStringLiteral(specifier)) {
			return "";
		}
		return this.module_path.module_symbol(source.fileName, specifier.text);
	}

	/** Responsibilities: _re-export declaration loading_. **/
	private export_statement(source: ts.SourceFile, statement: ts.Statement): void {
		const file = this.export_file(source, statement);
		if (file.length === 0) {
			return;
		}
		this.load_source(file);
	}

	/** Responsibilities: _imported statement loading_. **/
	private import_statement(source: ts.SourceFile, statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		const file = this.module_path.module_symbol(source.fileName, statement.moduleSpecifier.text);
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
		if (this.source_files.has(file)) {
			return;
		}
		const imported = this.source_resolver.get(file);
		if (imported === undefined) {
			return;
		}
		this.source_files.set(file, imported);
		this.register_source(imported);
		this.import_sources(imported);
	}

	/** Responsibilities: _source graph preparation_. **/
	private prepare_sources(): void {
		if (this.prepared_graphs.has(this)) {
			return;
		}
		this.register_source(this.root_source);
		this.import_sources(this.root_source);
		this.prepared_graphs.add(this);
	}

	/** Responsibilities: _initialization source graph_. **/
	public constructor(
		root_source: ts.SourceFile,
		declarations: Map<string, ts.Declaration>,
		module_path: TypeScriptPropertyModuleResolverContract,
		source_resolver: SourceFileResolver,
		source_index: AstPropertySourceIndexContract,
	) {
		this.source_files = new Map<string, ts.SourceFile>();
		this.prepared_graphs = new Set<AstPropertySourceGraph>();
		this.root_source = root_source;
		this.declaration_map = declarations;
		this.bindings = source_index;
		this.module_path = module_path;
		this.source_resolver = source_resolver;
		this.source_index = source_index;
		this.source_files.set(root_source.fileName, root_source);
	}

	/** Responsibilities: _source file lookup_. **/
	public source(file: string): ts.SourceFile {
		this.prepare_sources();
		const source = this.source_files.get(file);
		if (source !== undefined) {
			return source;
		}
		return this.root_source;
	}

	/** Responsibilities: _declaration lookup_. **/
	public declaration(key: string): AstDeclarationLookupContract {
		return new AstDeclarationLookup(this.declaration_map, key);
	}

	/** Responsibilities: _declaration map access_. **/
	/** Responsibilities: _binding type resolution_. **/
	public binding_type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		this.prepare_sources();
		return this.bindings.type(identifier, unknown_type);
	}
}
