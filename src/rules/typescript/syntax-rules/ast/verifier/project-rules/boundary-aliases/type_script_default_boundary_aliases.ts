import type { AstReferenceAlias } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type ts from "typescript";

/** Responsibilities: _default import alias mapping_, _binding support detection_. **/
export class TypeScriptDefaultBoundaryAliases {
	private readonly _resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _default alias collector initialization_. **/
	public constructor(resolver: TypeScriptModuleResolverContract) {
		this._resolver = resolver;
	}

	/** Responsibilities: _default import applicability_. **/
	public supports(bindings: ts.ImportClause): boolean {
		return bindings.name !== undefined;
	}

	/** Responsibilities: _default alias addition_. **/
	public append(aliases: AstReferenceAlias[], bindings: ts.ImportClause, module_path: string): void {
		if (!this.supports(bindings)) {
			return;
		}
		const name = bindings.name;
		if (name === undefined) {
			return;
		}
		const resolved = this._resolver.resolve({ file: module_path, name: "default" });
		if (resolved.name.length > 0) {
			aliases.push({ name: name.text, target: resolved.name });
		}
	}
}
