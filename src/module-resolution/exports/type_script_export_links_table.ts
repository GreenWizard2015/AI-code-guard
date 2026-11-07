import { TypeScriptExportLookup } from "src/module-resolution/exports/type_script_export_lookup";
import type {
	TypeScriptExportLinksContract,
	TypeScriptExportLookupOptions,
	TypeScriptModuleExportScopeContract,
} from "src/module-resolution/protocols";
import type {
	ModulePathResolverContract,
	TypeScriptModuleCache,
	TypeScriptModuleSymbolReference,
} from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _named import resolution_, _export lookup coordination_. **/
export class TypeScriptExportLinksTable implements TypeScriptExportLinksContract {
	private readonly _resolver: TypeScriptModuleExportScopeContract;
	private readonly _module_paths: ModulePathResolverContract;
	private readonly _module_cache: TypeScriptModuleCache;

	/** Responsibilities: _export link table initialization_. **/
	public constructor(
		resolver: TypeScriptModuleExportScopeContract,
		module_paths: ModulePathResolverContract,
		module_cache: TypeScriptModuleCache,
	) {
		this._resolver = resolver;
		this._module_paths = module_paths;
		this._module_cache = module_cache;
	}

	/** Responsibilities: _indexed imported binding resolution_. **/
	public imported_binding_name(
		file: string,
		statement: ts.ImportDeclaration,
		imported_name: string,
		visited: Set<string>,
	): TypeScriptModuleSymbolReference {
		const module_specifier = statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return { file: "", name: "" };
		}
		const imported_file = this._module_paths.module_symbol(file, module_specifier.text);
		if (imported_file.length === 0) {
			return { file: "", name: "" };
		}
		return this._resolver.file_for({
			reference: { file: imported_file, name: imported_name },
			visited,
		});
	}

	/** Responsibilities: _export target resolution_. **/
	public exported_target(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
	): TypeScriptModuleSymbolReference {
		const options: TypeScriptExportLookupOptions = {
			file,
			source_file,
			name,
			visited,
			resolver: this._resolver,
			module_paths: this._module_paths,
			module_cache: this._module_cache,
		};
		const lookup = new TypeScriptExportLookup(options);
		const named = lookup.named_target();
		if (named.file.length > 0) {
			return named;
		}
		return lookup.star_target();
	}
}
