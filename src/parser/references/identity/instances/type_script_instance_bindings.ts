import ts from "typescript";
import { TypeScriptInstanceScopeBindings } from "src/parser/references/identity/instances/type_script_instance_scope_bindings";

/** Responsibilities: _lexical binding storage_, _declaration owner lookup_. **/
export class TypeScriptInstanceBindings {
	private readonly values: Map<ts.Node, TypeScriptInstanceScopeBindings>;

	/** Responsibilities: _binding storage initialization_. **/
	public constructor() {
		this.values = new Map<ts.Node, TypeScriptInstanceScopeBindings>();
	}

	/** Responsibilities: _lexical binding storage_. **/
	public add(scope: ts.Node, name: string, declaration: ts.Node, owner: string): void {
		let scope_bindings = this.values.get(scope);
		if (scope_bindings === undefined) {
			scope_bindings = new TypeScriptInstanceScopeBindings();
			this.values.set(scope, scope_bindings);
		}
		scope_bindings.add(name, declaration, owner);
	}

	/** Responsibilities: _lexical binding lookup_. **/
	public bindings(scope: ts.Node, name: string): readonly { declaration: ts.Node; owner: string }[] {
		const scope_bindings = this.values.get(scope);
		if (scope_bindings === undefined) {
			return [];
		}
		return scope_bindings.bindings(name);
	}
}
