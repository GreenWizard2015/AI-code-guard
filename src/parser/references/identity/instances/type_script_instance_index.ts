import ts from "typescript";

import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import type { DestructuredAlias } from "src/model/types";
import type { TypeScriptInstanceLookup } from "src/model/types";
import type { DestructuredInstanceOptions } from "src/model/types";
import { TypeScriptInstanceBindings } from "src/parser/references/identity/instances/type_script_instance_bindings";
import { TypeScriptLexicalScope } from "src/parser/references/instance/type_script_lexical_scope";

/** Responsibilities: _scoped instance indexing_, _destructured alias storage_. **/
export class TypeScriptInstanceIndex implements TypeScriptInstanceStoreContract {
	private readonly _scope_resolver: TypeScriptLexicalScope;
	private readonly _instances: TypeScriptInstanceBindings;
	private readonly _imported_instances: Map<string, string>;

	/** Responsibilities: _binding owner before reference_. **/
	private binding_owner(
		bindings: readonly { declaration: ts.Node; owner: string }[],
		reference: ts.Node,
	): TypeScriptInstanceLookup {
		const reference_start = reference.getStart(reference.getSourceFile());
		let owner: TypeScriptInstanceLookup = { bound: false, value: "" };
		for (const binding of bindings) {
			if (binding.declaration.getStart(binding.declaration.getSourceFile()) <= reference_start) {
				owner = { bound: true, value: binding.owner };
			}
		}
		return owner;
	}

	/** Responsibilities: _initialization source file scope_. **/
	public constructor(source_file: ts.SourceFile) {
		this._instances = new TypeScriptInstanceBindings();
		this._imported_instances = new Map<string, string>();
		this._scope_resolver = new TypeScriptLexicalScope(source_file);
	}

	/** Responsibilities: _instance owner more addition_. **/
	public add(name: string, owner: string, ...nodes: ts.Node[]): void {
		const node = nodes[0];
		if (node) {
			let scope = this._scope_resolver.declaration_scope(node);
			if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
				scope = this._scope_resolver.assignment_scope(node);
			}
			this._instances.add(scope, name, node, owner);
			return;
		}
		this._imported_instances.set(name, owner);
	}

	/** Responsibilities: _instance owner supplied addition_. **/
	public add_all(entries: readonly DestructuredAlias[], node: ts.Node): void {
		for (const entry of entries) {
			this.add(entry.name, entry.owner, node);
		}
	}

	/** Responsibilities: _indexing instances introduced destructured_. **/
	public add_destructured(options: DestructuredInstanceOptions): void {
		const { node, initializer, current_owner, source_file, property_state } = options;
		if (!ts.isObjectBindingPattern(node.name)) {
			return;
		}
		this.add_all(property_state.destructured_aliases(node.name, source_file, initializer, current_owner), node);
	}

	/** Responsibilities: _resolution indexing owner name_. **/
	public instance_owner(name: string, node: ts.Node): TypeScriptInstanceLookup {
		for (const scope of this._scope_resolver.scope_chain(node)) {
			const owner = this.binding_owner(this._instances.bindings(scope, name), node);
			if (owner.bound) {
				return owner;
			}
		}
		for (const [imported_name, imported_owner] of this._imported_instances) {
			if (imported_name === name) {
				return { bound: true, value: imported_owner };
			}
		}
		return { bound: false, value: "" };
	}
}
