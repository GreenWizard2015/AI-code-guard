import type { TypeScriptExampleModuleCatalogContract } from "documentation_validation/protocols";
import type { TypeScriptExampleModuleRequest } from "documentation_validation/types";
import { DOCUMENTATION_FUNCTIONS_MODULE_NAME } from "src/constants";

/** Responsibilities: _virtual source module catalog_, _example module resolution_. **/
export class TypeScriptExampleModuleCatalog implements TypeScriptExampleModuleCatalogContract {
	private readonly _source_files: ReadonlyMap<string, string>;

	/** Responsibilities: _root module classification_. **/
	private is_root_module(specifier: string): boolean {
		if (specifier === DOCUMENTATION_FUNCTIONS_MODULE_NAME) {
			return true;
		}
		return specifier.startsWith("src/") || specifier.startsWith("tests/");
	}

	/** Responsibilities: _module base path derivation_. **/
	private module_base(request: TypeScriptExampleModuleRequest): string[] {
		if (this.is_root_module(request.specifier)) {
			return [];
		}
		const parent_parts = request.parent_path.split("/");
		parent_parts.pop();
		return parent_parts;
	}

	/** Responsibilities: _specifier path resolution_. **/
	private append_specifier(base: string[], specifier: string): void {
		for (const segment of specifier.split("/")) {
			if (segment === "." || segment.length === 0) {
				continue;
			}
			if (segment === "..") {
				base.pop();
				continue;
			}
			base.push(segment);
		}
	}

	/** Responsibilities: _first available module path_. **/
	private resolved_path(candidates: readonly string[]): string {
		for (const candidate of candidates) {
			if (this._source_files.has(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _virtual source catalog initialization_. **/
	public constructor(source_files: ReadonlyMap<string, string>) {
		this._source_files = source_files;
	}

	/** Responsibilities: _module source lookup_. **/
	public source_text(path: string): string {
		const source = this._source_files.get(path);
		if (source === undefined) {
			throw new Error(`Module ${path} is outside the example sources.`);
		}
		return source;
	}

	/** Responsibilities: _module request resolution_. **/
	public module(request: TypeScriptExampleModuleRequest): string {
		const base = this.module_base(request);
		this.append_specifier(base, request.specifier);
		const requested = base.join("/");
		const extensionless = requested.replace(/\.js$/u, "");
		const candidates = [requested, `${extensionless}.ts`, `${extensionless}/index.ts`];
		return this.resolved_path(candidates);
	}
}
