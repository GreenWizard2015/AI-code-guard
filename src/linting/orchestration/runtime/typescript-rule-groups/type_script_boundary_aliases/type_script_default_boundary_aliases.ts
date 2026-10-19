import ts from "typescript";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { AstReferenceAlias } from "src/types";

/** Responsibilities: _default import alias mapping_, _binding support detection_. **/
export class TypeScriptDefaultBoundaryAliases {
	private readonly resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _default alias collector initialization_. **/
	public constructor(resolver: TypeScriptModuleResolverContract) {
		this.resolver = resolver;
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
		const resolved = this.resolver.resolve(module_path, "default");
		if (resolved.name.length > 0) {
			aliases.push({ name: name.text, target: resolved.name });
		}
	}
}
