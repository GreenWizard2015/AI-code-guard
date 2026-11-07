import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { TypeScriptModuleExportsContract, TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";

/** Responsibilities: _module symbol resolution_, _declaration kind resolution_. **/
export class TestModuleResolver implements TypeScriptModuleResolverContract, TypeScriptModuleExportsContract {
	private readonly _mode: "jest-rules" | "runtime-patching";

	/** Responsibilities: _resolver test mode selection_. **/
	public constructor(mode: "jest-rules" | "runtime-patching" = "jest-rules") {
		this._mode = mode;
	}

	/** Responsibilities: _module path resolution_. **/
	public module_symbol(_file: string, module_name: string): string {
		if (this._mode === "runtime-patching") {
			return module_name === "features/latest_service" ? "/project/service.ts" : "";
		}
		return module_name;
	}

	/** Responsibilities: _export resolution_. **/
	public resolve(reference: TypeScriptModuleSymbolReference): TypeScriptModuleSymbolReference {
		if (this._mode === "runtime-patching") {
			return reference;
		}
		return { file: "", name: reference.name };
	}

	/** Responsibilities: _symbol kind identification_. **/
	public symbol_kind(_resolved: TypeScriptModuleSymbolReference): ResolvedTypeScriptDeclarationKind {
		if (this._mode === "runtime-patching") {
			return ResolvedTypeScriptDeclarationKind.Class;
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}
}
