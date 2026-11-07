import type { InstanceBinding, InstanceBindingsByName } from "src/parser/references/identity/instances/protocols";
import type ts from "typescript";

/** Responsibilities: _lexical binding storage_, _declaration owner lookup_. **/
export class TypeScriptInstanceBindings {
	private readonly _values: Map<ts.Node, InstanceBindingsByName>;

	/** Responsibilities: _binding storage initialization_. **/
	public constructor() {
		this._values = new Map();
	}

	/** Responsibilities: _lexical binding storage_. **/
	public add(scope: ts.Node, name: string, declaration: ts.Node, owner: string): void {
		let scope_bindings = this._values.get(scope);
		if (scope_bindings === undefined) {
			scope_bindings = new Map();
			this._values.set(scope, scope_bindings);
		}
		let entries = scope_bindings.get(name);
		if (entries === undefined) {
			entries = [];
			scope_bindings.set(name, entries);
		}
		entries.push({ declaration, owner });
	}

	/** Responsibilities: _lexical binding lookup_. **/
	public bindings(scope: ts.Node, name: string): readonly InstanceBinding[] {
		const scope_bindings = this._values.get(scope);
		if (scope_bindings === undefined) {
			return [];
		}
		const entries = scope_bindings.get(name);
		return entries ?? [];
	}
}
