import type { SourceFileResolverContract } from "src/core/project-source/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import { TypeScriptInheritedMethodSearch } from "src/parser/references/identity/references/ownership/type_script_inherited_method_search";
import type { TypeScriptInheritedMethodsContract } from "src/parser/references/identity/references/protocols";

/** Responsibilities: _inherited method lookup_, _method membership_. **/
export class TypeScriptInheritedMethods implements TypeScriptInheritedMethodsContract {
	private readonly _source_files: SourceFileResolverContract;
	private readonly _module_exports: TypeScriptModuleExportsContract;

	/** Responsibilities: _resolver initialization_. **/
	public constructor(source_files: SourceFileResolverContract, module_exports: TypeScriptModuleExportsContract) {
		this._source_files = source_files;
		this._module_exports = module_exports;
	}

	/** Responsibilities: _inherited method file lookup_. **/
	public file(file: string, class_name: string, method: string): string {
		const search = new TypeScriptInheritedMethodSearch({
			file,
			class_name,
			method,
			source_files: this._source_files,
			module_exports: this._module_exports,
			seen: new Set<string>(),
		});
		return search.file();
	}

	/** Responsibilities: _inherited method membership_. **/
	public contains(file: string, class_name: string, method: string): boolean {
		return this.file(file, class_name, method).length > 0;
	}
}
