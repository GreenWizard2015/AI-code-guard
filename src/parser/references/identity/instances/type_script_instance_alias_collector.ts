import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";
import ts from "typescript";

import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import type { TypeScriptInstanceAliasCollectorContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import { TypeScriptInstanceAssignment } from "src/parser/references/identity/instances/type_script_instance_assignment";
import { TypeScriptVariableInstanceAlias } from "src/parser/references/identity/instances/type_script_variable_instance_alias";
import { TypeScriptObjectPropertyCollector } from "src/parser/references/identity/properties/type_script_object_property_collector";
import type { TypeScriptObjectPropertyCollectorContract } from "src/typescript_runtime_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

import type { TypeScriptInstanceAliasCollectorOptions } from "src/parser/references/identity/instances/protocols";
import type { InstanceAliasResolversContract } from "src/types";

/** Responsibilities: _variable instance alias collection_, _parameter binding collection_. **/
export class TypeScriptInstanceAliasCollector implements TypeScriptInstanceAliasCollectorContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _aliases: Map<string, string>;
	private readonly _instances: TypeScriptInstanceStoreContract;
	private readonly _properties: TypeScriptPropertyStateContract;
	private readonly _resolvers: InstanceAliasResolversContract;
	private readonly _object_properties: TypeScriptObjectPropertyCollectorContract;
	private readonly _reference_helpers: TypeScriptReferenceBinding;
	private readonly _call_return_analysis: TypeScriptCallReturnAnalysis;
	private readonly _assignments: TypeScriptInstanceAssignment;
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<void>;
	private readonly _binding_node_kinds: readonly ts.SyntaxKind[];

	/** Responsibilities: _parameter instance aliases addition_. **/
	private append_parameter(node: ts.ParameterDeclaration): void {
		if (ts.isIdentifier(node.name)) {
			const owner = this._reference_helpers.parameter_owner(node);
			this._instances.add(node.name.text, owner, node);
			return;
		}
		for (const name of this.binding_names(node.name)) {
			this._instances.add(name, "", node);
		}
	}

	/** Responsibilities: _binding name collection_. **/
	private binding_names(name: ts.BindingName): readonly string[] {
		if (ts.isIdentifier(name)) {
			return [name.text];
		}
		const names: string[] = [];
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				names.push(...this.binding_names(element.name));
			}
		}
		return names;
	}

	/** Responsibilities: _variable and parameter aliases_. **/
	private append_variable_alias(node: ts.VariableDeclaration, owner: string): void {
		const variable_alias = new TypeScriptVariableInstanceAlias({
			node,
			owner,
			source_file: this._source_file,
			instances: this._instances,
			properties: this._properties,
			resolvers: this._resolvers,
			object_properties: this._object_properties,
			reference_helpers: this._reference_helpers,
			call_return_analysis: this._call_return_analysis,
		});
		variable_alias.append();
	}

	/** Responsibilities: _initialization TypeScript instance alias_. **/
	public constructor(options: TypeScriptInstanceAliasCollectorOptions) {
		this._reference_helpers = new TypeScriptReferenceBinding(options.aliases, options.instances);
		this._traversal = options.traversal;
		this._call_return_analysis = new TypeScriptCallReturnAnalysis();
		this._assignments = new TypeScriptInstanceAssignment(options.aliases, options.instances);
		this._source_file = options.source_file;
		this._aliases = options.aliases;
		this._instances = options.instances;
		this._properties = options.properties;
		this._resolvers = options.resolvers;
		this._object_properties = new TypeScriptObjectPropertyCollector(
			this._aliases,
			this._properties,
			this._instances,
			(expression) => this._call_return_analysis.unwrap_expression(expression),
		);
		this._node_dispatcher = new TypeScriptAstNodeObserverRegistry();
		this._binding_node_kinds = [
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.BinaryExpression,
		];
		this._node_dispatcher.register(
			TypeScriptAstDispatchPhase.ReferenceState,
			this._binding_node_kinds,
			(traversal_node) => {
				const { node, owner } = traversal_node;
				if (ts.isVariableDeclaration(node)) {
					this.append_variable_alias(node, owner);
				}
				if (ts.isParameter(node)) {
					this.append_parameter(node);
				}
				if (ts.isBinaryExpression(node)) {
					this._assignments.append(node);
				}
			},
		);
	}

	/** Responsibilities: _variable and parameter aliases_. **/
	public collect_bindings(): void {
		this._node_dispatcher.dispatch(
			TypeScriptAstDispatchPhase.ReferenceState,
			this._traversal,
			this._source_file,
			undefined,
		);
	}
}
