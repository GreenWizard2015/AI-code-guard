import { TypeScriptCallReturnAnalysis } from 'src/bridge/ts/parser/typescript-call-return-analysis';
import { TypeScriptReferenceHelpers } from 'src/bridge/ts/parser/typescript-reference-helpers';
import ts from 'typescript';

import type { TypeScriptInstanceStore } from 'src/model/protocols';
import type { TypeScriptPropertyState } from 'src/model/typescript-property-state';
import { TypeScriptObjectPropertyCollector } from 'src/parser/ts/typescript-object-property-collector';



import type { InstanceAliasResolvers } from 'src/types';

/** Responsibilities: _collection TypeScript instance aliases_. **/
export class TypeScriptInstanceAliasCollector {
	private readonly source_file: ts.SourceFile;
	private readonly aliases: Map<string, string>;
	private readonly instances: TypeScriptInstanceStore;
	private readonly properties: TypeScriptPropertyState;
	private readonly resolvers: InstanceAliasResolvers;
	private readonly object_properties: TypeScriptObjectPropertyCollector;

	/** Responsibilities: _resolution current class owner_. **/
	private class_owner(node: ts.Node, owner: string = ''): string {
		if (ts.isClassLike(node)) {
			if (node.name) {
				return node.name.text;
			}
			return '';
		}
		if (owner !== undefined) {
			return owner;
		}
		return '';
	}

	/** Responsibilities: _parameter instance aliases addition_. **/
	private append_parameter(node: ts.ParameterDeclaration): void {
		const script_reference_helpers = new TypeScriptReferenceHelpers();

		if (!ts.isIdentifier(node.name)) {
			return;
		}
		const owner = script_reference_helpers.parameter_owner(node, this.aliases);
		if (owner) {
			this.instances.add(node.name.text, owner, node);
		}
	}

	/** Responsibilities: _destructured instance aliases addition_. **/
	private append_destructured(
		node: ts.VariableDeclaration,
		initializer: ts.Expression,
		owner: string = ''
	): boolean {
		if (!ts.isObjectBindingPattern(node.name)) {
			return false;
		}
		this.instances.add_destructured({
			node,
			initializer,
			current_owner: owner,
			source_file: this.source_file,
			property_state: this.properties,
		});
		return true;
	}

	/** Responsibilities: _instance aliases addition construction_. **/
	private append_constructed(
		node: ts.VariableDeclaration,
		initializer: ts.Expression
	): boolean {
		const script_reference_helpers = new TypeScriptReferenceHelpers();

		if (script_reference_helpers.new_instance(node, this.aliases, this.instances, initializer)) {
			return true;
		}
		return this.object_properties.appended(node, initializer);
	}

	/** Responsibilities: _aggregation invocation result aliases_. **/
	private append_call(node: ts.VariableDeclaration, owner: string = ''): boolean {
		const analysis = new TypeScriptCallReturnAnalysis();
		let initializers: ts.Expression[] = [];
		if (node.initializer !== undefined) {
			initializers = analysis.unwrap_expression(node.initializer);
		}
		return this.append_call_initializer(node, owner, initializers);
	}

	/** Responsibilities: _aggregation invocation initializer alias_. **/
	private append_call_initializer(
		node: ts.VariableDeclaration,
		owner: string,
		initializers: ts.Expression[]
	): boolean {
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
		const helpers = new TypeScriptReferenceHelpers();
		const type_name = helpers.resolved_reference_name(node.type, this.aliases);
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
		initializers: ts.Expression[]
	): boolean {
		if (initializers.length === 0) {
			return false;
		}
		const initializer = initializers[0];
		if (this.append_destructured(node, initializer, owner)) {
			return true;
		}
return this.append_constructed(node, initializer) || this.append_call(node, owner);
	}

	/** Responsibilities: _aggregation aliases variable_. **/
	private append_variable(node: ts.VariableDeclaration, owner: string = ''): void {
		const analysis = new TypeScriptCallReturnAnalysis();
		let initializers: ts.Expression[] = [];
		if (node.initializer !== undefined) {
			initializers = analysis.unwrap_expression(node.initializer);
		}
		if (this.append_variable_initializer(node, owner, initializers)) {
			return;
		}
		if (this.append_typed_variable(node)) {
			return;
		}
	}

	/** Responsibilities: _variable collection aliases traversal_. **/
	private visit_variable(node: ts.Node, owner: string = ''): void {
		const current_owner = this.class_owner(node, owner);
		if (ts.isVariableDeclaration(node)) {
			this.append_variable(node, current_owner);
		}
		ts.forEachChild(node, child => this.visit_variable(child, current_owner));
	}

	/** Responsibilities: _parameter collection aliases traversal_. **/
	private visit_parameter(node: ts.Node): void {
		if (ts.isParameter(node)) {
			this.append_parameter(node);
		}
		ts.forEachChild(node, child => this.visit_parameter(child));
	}

	/** Responsibilities: _initialization TypeScript instance alias_. **/
	public constructor(
		source_file: ts.SourceFile,
		aliases: Map<string, string>,
		instances: TypeScriptInstanceStore,
		properties: TypeScriptPropertyState,
		resolvers: InstanceAliasResolvers
	) {
		const call_return_analysis = new TypeScriptCallReturnAnalysis();

		this.source_file = source_file;
		this.aliases = aliases;
		this.instances = instances;
		this.properties = properties;
		this.resolvers = resolvers;
		this.object_properties = new TypeScriptObjectPropertyCollector(
			this.aliases,
			this.properties,
			expression => call_return_analysis.unwrap_expression(expression)
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
}
