import ts from "typescript";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { AstReferenceAlias } from "src/types";

/** Responsibilities: _named import alias mapping_, _binding support detection_. **/
export class TypeScriptNamedBoundaryAliases {
	private readonly resolver: TypeScriptModuleResolverContract;

	/** Responsibilities: _named boundary alias element_. **/
	private append_element(aliases: AstReferenceAlias[], element: ts.ImportSpecifier, module_path: string): void {
		let imported_name = element.name.text;
		if (element.propertyName !== undefined) {
			imported_name = element.propertyName.text;
		}
		const resolved = this.resolver.resolve(module_path, imported_name);
		if (resolved.name.length > 0 && resolved.name !== element.name.text) {
			aliases.push({ name: element.name.text, target: resolved.name });
		}
	}

	/** Responsibilities: _named alias collector initialization_. **/
	public constructor(resolver: TypeScriptModuleResolverContract) {
		this.resolver = resolver;
	}

	/** Responsibilities: _named import applicability_. **/
	public supports(bindings: ts.ImportClause): boolean {
		if (bindings.namedBindings === undefined) {
			return false;
		}
		return ts.isNamedImports(bindings.namedBindings);
	}

	/** Responsibilities: _named alias addition_. **/
	public append(aliases: AstReferenceAlias[], bindings: ts.ImportClause, module_path: string): void {
		if (!this.supports(bindings)) {
			return;
		}
		const named_bindings = bindings.namedBindings;
		if (named_bindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(named_bindings)) {
			return;
		}
		for (const element of named_bindings.elements) {
			this.append_element(aliases, element, module_path);
		}
	}
}
