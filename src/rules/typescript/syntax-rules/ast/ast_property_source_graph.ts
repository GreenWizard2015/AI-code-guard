import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { AstDeclarationLookup } from "src/rules/typescript/syntax-rules/ast/ast_declaration_lookup";
import type {
	AstPropertyBindingResolverContract,
	AstPropertySourceGraphContract,
	AstPropertySourceIndexContract,
} from "src/source_protocols";
import type { AstDeclarationLookupContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _imported declaration graph assembly_, _re-export traversal_. **/
export class AstPropertySourceGraph implements AstPropertySourceGraphContract {
	private readonly _root_source: ts.SourceFile;
	private readonly _source_files: Map<string, ts.SourceFile>;
	private readonly _declaration_map: Map<string, ts.Declaration>;
	private readonly _bindings: AstPropertyBindingResolverContract;
	private readonly _prepared_graphs: Set<AstPropertySourceGraph>;
	private readonly _module_path: TypeScriptPropertyModuleResolverContract;
	private readonly _source_resolver: SourceFileResolver;
	private readonly _source_index: AstPropertySourceIndexContract;

	/** Responsibilities: _source declaration registration_. **/
	private register_source(declaration_source: ts.SourceFile): void {
		for (const [key, declaration] of this._source_index.declarations_for(declaration_source)) {
			this._declaration_map.set(key, declaration);
		}
	}

	/** Responsibilities: _imported source loading_. **/
	private import_sources(importing_file: ts.SourceFile): void {
		const reexports: ts.ExportDeclaration[] = [];
		for (const import_statement of importing_file.statements) {
			if (ts.isImportDeclaration(import_statement)) {
				if (ts.isStringLiteral(import_statement.moduleSpecifier)) {
					this.load_import(importing_file, import_statement.moduleSpecifier.text);
				}
			} else if (ts.isExportDeclaration(import_statement)) {
				reexports.push(import_statement);
			}
		}
		for (const reexport of reexports) {
			this.export_statement(importing_file, reexport);
		}
	}

	/** Responsibilities: _re-export declaration registration_. **/
	private export_file(reexporting_file: ts.SourceFile, export_declaration: ts.ExportDeclaration): string {
		const specifier = export_declaration.moduleSpecifier;
		if (specifier === undefined) {
			return "";
		}
		if (!ts.isStringLiteral(specifier)) {
			return "";
		}
		return this._module_path.module_symbol(reexporting_file.fileName, specifier.text);
	}

	/** Responsibilities: _re-export declaration loading_. **/
	private export_statement(export_owner: ts.SourceFile, reexport_statement: ts.ExportDeclaration): void {
		const file = this.export_file(export_owner, reexport_statement);
		if (file.length === 0) {
			return;
		}
		this.load_source(file);
	}

	/** Responsibilities: _imported statement loading_. **/
	private load_import(importing_file: ts.SourceFile, specifier: string): void {
		const file = this._module_path.module_symbol(importing_file.fileName, specifier);
		if (file.length === 0) {
			return;
		}
		if (this._source_files.has(file)) {
			return;
		}
		this.load_source(file);
	}

	/** Responsibilities: _imported source registration_. **/
	private load_source(file: string): void {
		if (this._source_files.has(file)) {
			return;
		}
		const imported = this._source_resolver.get(file);
		if (imported === undefined) {
			return;
		}
		this._source_files.set(file, imported);
		this.register_source(imported);
		this.import_sources(imported);
	}

	/** Responsibilities: _source graph preparation_. **/
	private prepare_sources(): void {
		if (this._prepared_graphs.has(this)) {
			return;
		}
		this.register_source(this._root_source);
		this.import_sources(this._root_source);
		this._prepared_graphs.add(this);
	}

	/** Responsibilities: _initialization source graph_. **/
	public constructor(
		root_source: ts.SourceFile,
		declarations: Map<string, ts.Declaration>,
		module_path: TypeScriptPropertyModuleResolverContract,
		source_resolver: SourceFileResolver,
		source_index: AstPropertySourceIndexContract,
	) {
		this._source_files = new Map<string, ts.SourceFile>();
		this._prepared_graphs = new Set<AstPropertySourceGraph>();
		this._root_source = root_source;
		this._declaration_map = declarations;
		this._bindings = source_index;
		this._module_path = module_path;
		this._source_resolver = source_resolver;
		this._source_index = source_index;
		this._source_files.set(root_source.fileName, root_source);
	}

	/** Responsibilities: _source file lookup_. **/
	public source(file: string): ts.SourceFile {
		this.prepare_sources();
		const source = this._source_files.get(file);
		if (source !== undefined) {
			return source;
		}
		return this._root_source;
	}

	/** Responsibilities: _declaration lookup_. **/
	public declaration(key: string): AstDeclarationLookupContract {
		return new AstDeclarationLookup(this._declaration_map, key);
	}

	/** Responsibilities: _declaration map access_. **/
	/** Responsibilities: _binding type resolution_. **/
	public binding_type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode {
		this.prepare_sources();
		return this._bindings.type(identifier, unknown_type);
	}
}
