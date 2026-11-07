import { TYPESCRIPT_FORBIDDEN_GLOBAL_NAMES } from "documentation_validation/constants";
import type { TypeScriptExampleModuleCatalogContract } from "documentation_validation/protocols";
import { TypeScriptModuleImportPolicy } from "documentation_validation/sandbox/typescript/type_script_module_import_policy";
import { TypeScriptReflectionPolicy } from "documentation_validation/sandbox/typescript/type_script_reflection_policy";
import { TypeScriptRuntimeCapabilityPolicy } from "documentation_validation/sandbox/typescript/type_script_runtime_capability_policy";
import ts from "typescript";

/** Responsibilities: _TypeScript policy composition_, _source diagnostic aggregation_. **/
export class TypeScriptExamplePolicy {
	private readonly _source_files: ReadonlyMap<string, string>;
	private readonly _module_catalog: TypeScriptExampleModuleCatalogContract;

	/** Responsibilities: _TypeScript example policy setup_. **/
	public constructor(
		source_files: ReadonlyMap<string, string>,
		module_catalog: TypeScriptExampleModuleCatalogContract,
	) {
		this._source_files = source_files;
		this._module_catalog = module_catalog;
	}

	/** Responsibilities: _single source safety diagnostics_. **/
	public file_issues(path: string, text: string): string[] {
		const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
		const imports = new TypeScriptModuleImportPolicy(this._module_catalog, path, source);
		const reflection = new TypeScriptReflectionPolicy(path, source);
		const runtime = new TypeScriptRuntimeCapabilityPolicy(path, source, TYPESCRIPT_FORBIDDEN_GLOBAL_NAMES);
		return [...imports.issues(), ...reflection.issues(), ...runtime.issues()];
	}

	/** Responsibilities: _project source safety diagnostics_. **/
	public issues(): string[] {
		const issues: string[] = [];
		for (const [path, text] of this._source_files) {
			issues.push(...this.file_issues(path, text));
		}
		return [...new Set(issues)];
	}
}
