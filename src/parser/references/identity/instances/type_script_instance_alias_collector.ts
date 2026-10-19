import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";
import ts from "typescript";

import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import type { TypeScriptInstanceAliasCollectorContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import type { TypeScriptObjectPropertyCollectorContract } from "src/protocols";
import { TypeScriptObjectPropertyCollector } from "src/parser/references/identity/properties/type_script_object_property_collector";
import { TypeScriptInstanceAssignment } from "src/parser/references/identity/instances/type_script_instance_assignment";

import type { InstanceAliasResolvers } from "src/types";
import type { DestructuredAlias } from "src/model/types";

/** Responsibilities: _variable instance alias collection_, _parameter binding collection_. **/
export class TypeScriptInstanceAliasCollector implements TypeScriptInstanceAliasCollectorContract {
	private readonly source_file: ts.SourceFile;
	private readonly aliases: Map<string, string>;
	private readonly instances: TypeScriptInstanceStoreContract;
	private readonly properties: TypeScriptPropertyStateContract;
	private readonly resolvers: InstanceAliasResolvers;
	private readonly object_properties: TypeScriptObjectPropertyCollectorContract;
	private readonly reference_helpers: TypeScriptReferenceBinding;
	private readonly call_return_analysis: TypeScriptCallReturnAnalysis;
	private readonly assignments: TypeScriptInstanceAssignment;

	/** Responsibilities: _resolution current class owner_. **/
	private class_owner(node: ts.Node, owner: string = ""): string {
		if (ts.isClassLike(node)) {
			if (node.name) {
				return node.name.text;
			}
			return "";
		}
		if (owner !== undefined) {
			return owner;
		}
		return "";
	}

	/** Responsibilities: _parameter instance aliases addition_. **/
	private append_parameter(node: ts.ParameterDeclaration): void {
		if (ts.isIdentifier(node.name)) {
			const owner = this.reference_helpers.parameter_owner(node, this.aliases);
			this.instances.add(node.name.text, owner, node);
			return;
		}
		for (const name of this.binding_names(node.name)) {
			this.instances.add(name, "", node);
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

	/** Responsibilities: _destructured instance aliases addition_. **/
	private append_destructured(node: ts.VariableDeclaration, initializer: ts.Expression, owner: string = ""): boolean {
		if (!ts.isObjectBindingPattern(node.name) && !ts.isArrayBindingPattern(node.name)) {
			return false;
		}
		let aliases: readonly DestructuredAlias[] = [];
		if (ts.isObjectBindingPattern(node.name)) {
			aliases = this.properties.destructured_aliases(node.name, this.source_file, initializer, owner);
		}
		const resolved_names = new Set(aliases.map((alias) => alias.name));
		for (const name of this.binding_names(node.name)) {
			if (!resolved_names.has(name)) {
				this.instances.add(name, "", node);
			}
		}
		for (const alias of aliases) {
			this.instances.add(alias.name, alias.owner, node);
		}
		return true;
	}

	/** Responsibilities: _instance aliases addition construction_. **/
	private append_constructed(node: ts.VariableDeclaration, initializer: ts.Expression): boolean {
		if (this.reference_helpers.new_instance(node, this.aliases, this.instances, initializer)) {
			return true;
		}
		this.object_properties.appended(node, initializer);
		return false;
	}

	/** Responsibilities: _instance reference alias addition_. **/
	private append_reference_alias(node: ts.VariableDeclaration, initializer: ts.Expression): boolean {
		if (!ts.isIdentifier(node.name) || !ts.isIdentifier(initializer)) {
			return false;
		}
		const owner = this.instances.instance_owner(initializer.text, initializer);
		if (!owner.bound) {
			return false;
		}
		this.instances.add(node.name.text, owner.value, node);
		return true;
	}

	/** Responsibilities: _aggregation invocation result aliases_. **/
	private append_call(node: ts.VariableDeclaration, owner: string = ""): boolean {
		let initializers: ts.Expression[] = [];
		if (node.initializer !== undefined) {
			initializers = this.call_return_analysis.unwrap_expression(node.initializer);
		}
		return this.append_call_initializer(node, owner, initializers);
	}

	/** Responsibilities: _aggregation invocation initializer alias_. **/
	private append_call_initializer(node: ts.VariableDeclaration, owner: string, initializers: ts.Expression[]): boolean {
		if (initializers.length === 0) {
			return false;
		}
		const initializer = initializers[0];
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		const resolved_owner = this.call_owner(initializer, owner);
		if (!resolved_owner) {
			return false;
		}
		this.instances.add(node.name.getText(this.source_file), resolved_owner, node);
		return true;
	}

	/** Responsibilities: _resolution invocation owner_. **/
	private call_owner(initializer: ts.CallExpression, owner: string): string {
		let resolved_owner = this.resolvers.call_owner(initializer.expression, owner);
		if (!resolved_owner && ts.isPropertyAccessExpression(initializer.expression)) {
			resolved_owner = this.resolvers.property_owner(initializer.expression, owner);
		}
		return resolved_owner;
	}

	/** Responsibilities: _typed variable aliases addition_. **/
	private append_typed_variable(node: ts.VariableDeclaration): boolean {
		if (node.type === undefined) {
			return false;
		}
		const type_name = this.reference_helpers.resolved_reference_name(node.type, this.aliases);
		if (!type_name) {
			return false;
		}
		this.instances.add(node.name.getText(this.source_file), type_name, node);
		return true;
	}

	/** Responsibilities: _aggregation aliases variable initializer_. **/
	private append_variable_initializer(
		node: ts.VariableDeclaration,
		owner: string,
		initializers: ts.Expression[],
	): boolean {
		if (initializers.length === 0) {
			return false;
		}
		const initializer = initializers[0];
		if (this.append_destructured(node, initializer, owner)) {
			return true;
		}
		if (this.append_reference_alias(node, initializer)) {
			return true;
		}
		return this.append_constructed(node, initializer) || this.append_call(node, owner);
	}

	/** Responsibilities: _aggregation aliases variable_. **/
	private append_variable(node: ts.VariableDeclaration, owner: string = ""): void {
		let initializers: ts.Expression[] = [];
		if (node.initializer !== undefined) {
			initializers = this.call_return_analysis.unwrap_expression(node.initializer);
		}
		if (this.append_variable_initializer(node, owner, initializers)) {
			return;
		}
		if (this.append_typed_variable(node)) {
			return;
		}
		for (const name of this.binding_names(node.name)) {
			this.instances.add(name, "", node);
		}
	}

	/** Responsibilities: _variable collection aliases traversal_. **/
	private visit_variable(node: ts.Node, owner: string = ""): void {
		const current_owner = this.class_owner(node, owner);
		if (ts.isVariableDeclaration(node)) {
			this.append_variable(node, current_owner);
		}
		ts.forEachChild(node, (child) => this.visit_variable(child, current_owner));
	}

	/** Responsibilities: _parameter collection aliases traversal_. **/
	private visit_parameter(node: ts.Node): void {
		if (ts.isParameter(node)) {
			this.append_parameter(node);
		}
		ts.forEachChild(node, (child) => this.visit_parameter(child));
	}

	/** Responsibilities: _variable and parameter aliases_. **/
	private visit_bindings(node: ts.Node, owner: string = ""): void {
		const current_owner = this.class_owner(node, owner);
		if (ts.isVariableDeclaration(node)) {
			this.append_variable(node, current_owner);
		}
		if (ts.isParameter(node)) {
			this.append_parameter(node);
		}
		if (ts.isBinaryExpression(node)) {
			this.assignments.append(node, this.aliases, this.instances);
		}
		ts.forEachChild(node, (child) => this.visit_bindings(child, current_owner));
	}

	/** Responsibilities: _initialization TypeScript instance alias_. **/
	public constructor(
		source_file: ts.SourceFile,
		aliases: Map<string, string>,
		instances: TypeScriptInstanceStoreContract,
		properties: TypeScriptPropertyStateContract,
		resolvers: InstanceAliasResolvers,
	) {
		this.reference_helpers = new TypeScriptReferenceBinding();
		this.call_return_analysis = new TypeScriptCallReturnAnalysis();
		this.assignments = new TypeScriptInstanceAssignment();
		this.source_file = source_file;
		this.aliases = aliases;
		this.instances = instances;
		this.properties = properties;
		this.resolvers = resolvers;
		this.object_properties = new TypeScriptObjectPropertyCollector(
			this.aliases,
			this.properties,
			this.instances,
			(expression) => this.call_return_analysis.unwrap_expression(expression),
		);
	}

	/** Responsibilities: _variable aliases collection_. **/
	public collect_variables(): void {
		this.visit_variable(this.source_file);
	}

	/** Responsibilities: _parameter aliases collection_. **/
	public collect_parameters(): void {
		this.visit_parameter(this.source_file);
	}

	/** Responsibilities: _variable and parameter aliases_. **/
	public collect_bindings(): void {
		this.visit_bindings(this.source_file);
	}
}
