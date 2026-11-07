import { SHARED_MODULE_CACHES } from "src/constants";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptModulePathCatalog } from "src/module-resolution/path-resolution/type_script_module_path_catalog";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/project-resolution/type_script_project_resolution_cache";
import type {
	TypeScriptModuleCache,
	TypeScriptModuleExportLookupContract,
	TypeScriptModuleExportsContract,
} from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _import declaration inspection_, _export declaration resolution_. **/
export class TypeScriptModuleExports implements TypeScriptModuleExportLookupContract {
	private readonly _import_resolver: TypeScriptModuleExportsContract;
	private readonly _source_catalog: TypeScriptModulePathCatalog;
	private readonly _module_cache: TypeScriptModuleCache;

	/** Responsibilities: _resolution exported variable declaration_. **/
	private exported_variable(
		variable_statement: ts.VariableStatement,
		variable_export_name: string,
	): ts.VariableDeclaration[] {
		for (const declaration of variable_statement.declarationList.declarations) {
			if (declaration.name.getText(variable_statement.getSourceFile()) === variable_export_name) {
				return [declaration];
			}
		}
		return [];
	}

	/** Responsibilities: _exported declaration index construction_. **/
	private declaration_index(indexed_file: ts.SourceFile): ReadonlyMap<string, readonly ts.Node[]> {
		const cached = this._module_cache.exported_declarations.get(indexed_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, ts.Node[]>();
		for (const statement of indexed_file.statements) {
			this.append_function_declaration(index, statement);
			this.append_variable_declarations(index, statement, indexed_file);
		}
		this._module_cache.exported_declarations.set(indexed_file, index);
		return index;
	}

	/** Responsibilities: _exported function declaration indexing_. **/
	private append_function_declaration(index: Map<string, ts.Node[]>, function_statement: ts.Statement): void {
		if (!ts.isFunctionDeclaration(function_statement)) {
			return;
		}
		if (function_statement.name === undefined) {
			return;
		}
		index.set(function_statement.name.text, [function_statement]);
	}

	/** Responsibilities: _exported variable declaration indexing_. **/
	private append_variable_declarations(
		index: Map<string, ts.Node[]>,
		variable_statement: ts.Statement,
		variable_source: ts.SourceFile,
	): void {
		if (!ts.isVariableStatement(variable_statement)) {
			return;
		}
		for (const declaration of variable_statement.declarationList.declarations) {
			const name = declaration.name.getText(variable_source);
			const declarations = index.get(name);
			if (declarations === undefined) {
				index.set(name, [declaration]);
				continue;
			}
			declarations.push(declaration);
		}
	}

	/** Responsibilities: _TypeScript import resolver initialization_. **/
	public constructor(
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		let source_caches = SHARED_MODULE_CACHES.get(source_files);
		if (source_caches === undefined) {
			source_caches = new WeakMap<ProjectSourceIOContract, TypeScriptModuleCache>();
			SHARED_MODULE_CACHES.set(source_files, source_caches);
		}
		const cached = source_caches.get(source_io);
		if (cached !== undefined) {
			this._module_cache = cached;
		} else {
			const created: TypeScriptModuleCache = {
				module_symbols: new Map(),
				resolved_exports: new Map(),
				resolutions: new WeakMap(),
				declaration_indexes: new WeakMap(),
				default_declarations: new WeakMap(),
				export_assignments: new WeakMap(),
				exported_declarations: new WeakMap(),
				named_export_indexes: new WeakMap(),
				local_import_indexes: new WeakMap(),
				symbol_kinds: new WeakMap(),
			};
			source_caches.set(source_io, created);
			this._module_cache = created;
		}
		let project_resolutions = this._module_cache.resolutions.get(source_io);
		if (project_resolutions === undefined) {
			project_resolutions = new TypeScriptProjectResolutionCache(source_io);
			this._module_cache.resolutions.set(source_io, project_resolutions);
		}
		if (this._module_cache.symbol_kinds === undefined) {
			this._module_cache.symbol_kinds = new WeakMap();
		}
		const resolution = project_resolutions.resolution(project_root, filesystem_fallback);
		this._source_catalog = new TypeScriptModulePathCatalog(
			project_root,
			source_files,
			filesystem_fallback,
			resolution,
			source_io,
		);
		const resolver_factory = new TypeScriptModuleExportsContext(
			project_root,
			source_files,
			filesystem_fallback,
			source_io,
		);
		this._import_resolver = resolver_factory.module_exports();
	}

	/** Responsibilities: _collection named import bindings_. **/
	public named_imports(import_statement: ts.Statement): ts.NamedImports[] {
		if (!ts.isImportDeclaration(import_statement)) {
			return [];
		}
		const bindings = import_statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return [bindings];
	}

	/** Responsibilities: _resolution source file path_. **/
	public imported_file(importer_source: ts.SourceFile, import_statement: ts.Statement): string {
		if (!ts.isImportDeclaration(import_statement) || !ts.isStringLiteral(import_statement.moduleSpecifier)) {
			return "";
		}
		const file = this._import_resolver.module_symbol(importer_source.fileName, import_statement.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return "";
	}

	/** Responsibilities: _resolution named exported declaration_. **/
	public exported_declaration(export_statement: ts.Statement, declaration_name: string): ts.Node[] {
		if (ts.isFunctionDeclaration(export_statement) && export_statement.name?.text === declaration_name) {
			return [export_statement];
		}
		if (!ts.isVariableStatement(export_statement)) {
			return [];
		}
		return this.exported_variable(export_statement, declaration_name);
	}

	/** Responsibilities: _resolution forwarded exported declaration_. **/
	public resolved_exported_declaration(file: string, resolved_name: string): ts.Node[] {
		const resolved = this._import_resolver.resolve({ file, name: resolved_name });
		if (resolved.file.length === 0) {
			return [];
		}
		const source_file = this._source_catalog.source(resolved.file).source_file();
		const declarations = this.declaration_index(source_file).get(resolved.name);
		if (declarations !== undefined) {
			return [...declarations];
		}
		return [];
	}
}
