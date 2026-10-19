import ts from "typescript";
import { TypeScriptModuleExports as TypeScriptModulePathResolver } from "src/module-resolution/type_script_module_exports";
import { TypeScriptModulePathCatalog } from "src/module-resolution/type_script_module_path_catalog";
import type {
	TypeScriptModuleExportLookupContract,
	TypeScriptModuleExportsContract,
	TypeScriptModuleCache,
} from "src/module-resolution/types";
import { SHARED_MODULE_CACHES } from "src/module-resolution/constants";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/type_script_project_resolution_cache";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _import declaration inspection_, _export declaration resolution_. **/
export class TypeScriptModuleExports implements TypeScriptModuleExportLookupContract {
	private readonly import_resolver: TypeScriptModuleExportsContract;
	private readonly source_catalog: TypeScriptModulePathCatalog;
	private readonly module_cache: TypeScriptModuleCache;

	/** Responsibilities: _resolution exported variable declaration_. **/
	private exported_variable(statement: ts.VariableStatement, exported_name: string): ts.VariableDeclaration[] {
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.name.getText(statement.getSourceFile()) === exported_name) {
				return [declaration];
			}
		}
		return [];
	}

	/** Responsibilities: _exported declaration index construction_. **/
	private declaration_index(source_file: ts.SourceFile): ReadonlyMap<string, readonly ts.Node[]> {
		const cached = this.module_cache.exported_declarations.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, ts.Node[]>();
		for (const statement of source_file.statements) {
			this.append_function_declaration(index, statement);
			this.append_variable_declarations(index, statement, source_file);
		}
		this.module_cache.exported_declarations.set(source_file, index);
		return index;
	}

	/** Responsibilities: _exported function declaration indexing_. **/
	private append_function_declaration(index: Map<string, ts.Node[]>, statement: ts.Statement): void {
		if (!ts.isFunctionDeclaration(statement)) {
			return;
		}
		if (statement.name === undefined) {
			return;
		}
		index.set(statement.name.text, [statement]);
	}

	/** Responsibilities: _exported variable declaration indexing_. **/
	private append_variable_declarations(
		index: Map<string, ts.Node[]>,
		statement: ts.Statement,
		source_file: ts.SourceFile,
	): void {
		if (!ts.isVariableStatement(statement)) {
			return;
		}
		for (const declaration of statement.declarationList.declarations) {
			const name = declaration.name.getText(source_file);
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
		const cached = SHARED_MODULE_CACHES.get(source_files);
		if (cached !== undefined) {
			this.module_cache = cached;
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
			SHARED_MODULE_CACHES.set(source_files, created);
			this.module_cache = created;
		}
		let project_resolutions = this.module_cache.resolutions.get(source_io);
		if (project_resolutions === undefined) {
			project_resolutions = new TypeScriptProjectResolutionCache(source_io);
			this.module_cache.resolutions.set(source_io, project_resolutions);
		}
		if (this.module_cache.symbol_kinds === undefined) {
			this.module_cache.symbol_kinds = new WeakMap();
		}
		const resolution = project_resolutions.resolution(project_root, filesystem_fallback);
		this.source_catalog = new TypeScriptModulePathCatalog(
			project_root,
			source_files,
			filesystem_fallback,
			resolution,
			source_io,
		);
		this.import_resolver = new TypeScriptModulePathResolver(
			project_root,
			source_files,
			filesystem_fallback,
			source_io,
		);
	}

	/** Responsibilities: _collection named import bindings_. **/
	public named_imports(statement: ts.Statement): ts.NamedImports[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return [bindings];
	}

	/** Responsibilities: _resolution source file path_. **/
	public imported_file(source_file: ts.SourceFile, statement: ts.Statement): string {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		const file = this.import_resolver.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return "";
	}

	/** Responsibilities: _resolution named exported declaration_. **/
	public exported_declaration(statement: ts.Statement, exported_name: string): ts.Node[] {
		if (ts.isFunctionDeclaration(statement)) {
			if (statement.name?.text === exported_name) {
				return [statement];
			}
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return this.exported_variable(statement, exported_name);
	}

	/** Responsibilities: _resolution forwarded exported declaration_. **/
	public resolved_exported_declaration(file: string, exported_name: string): ts.Node[] {
		const resolved = this.import_resolver.resolve(file, exported_name);
		if (resolved.file.length === 0) {
			return [];
		}
		const source_file = this.source_catalog.source_file(resolved.file);
		const declarations = this.declaration_index(source_file).get(resolved.name);
		if (declarations !== undefined) {
			return [...declarations];
		}
		return [];
	}
}
