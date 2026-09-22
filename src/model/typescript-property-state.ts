import { TypeScriptReferenceHelpers } from 'src/bridge/ts/parser/typescript-reference-helpers';
import { TypeScriptDestructuredAliasCollector } from 'src/model/typescript-destructured-alias-collector';
import type { DestructuredAlias } from 'src/model/types';
import ts from 'typescript';

import type { TypeScriptInstanceStore } from 'src/model/protocols';
import type { CallOwnerResolver } from 'src/model/protocols';
/** Responsibilities: _collection TypeScript property ownership_. **/
export class TypeScriptPropertyState {
	private readonly aliases: Map<string, string>;
	private readonly call_owner: CallOwnerResolver;
	private readonly instances: TypeScriptInstanceStore;
	private readonly destructured_alias_collector: TypeScriptDestructuredAliasCollector;
	private readonly properties = new Map<string, string>();

	/** Responsibilities: _typed parameter property recording_. **/
	private append_parameter(node: ts.ParameterDeclaration, owner: string): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		const parameter_name = node.name;
		const parameter_type = node.type;
		if (parameter_type !== undefined) {
			this.append_named(parameter_name, owner, parameter_type);
		}
		this.append_initialized(node, owner);
	}

	/** Responsibilities: _named property state_. **/
	private append_named(name: ts.PropertyName, owner: string, type: ts.TypeNode): void {
		const script_reference_helpers = new TypeScriptReferenceHelpers();

		if (!ts.isIdentifier(name)) {
			return;
		}
		const type_name = script_reference_helpers.resolved_reference_name(type, this.aliases);
		if (type_name) {
			this.properties.set(`${owner}.${name.text}`, type_name);
		}
	}

	/** Responsibilities: _inspection initialization property declaration_. **/
	private append_initialized(
		node: ts.Node,
		owner: string
	): void {
		if (!ts.isPropertyDeclaration(node) && !ts.isParameter(node)) {
			return;
		}
		if (!node.initializer || !ts.isIdentifier(node.name)) {
			return;
		}
		if (ts.isCallExpression(node.initializer)) {
			this.append_call_initializer(node.name.text, node.initializer, owner);
			return;
		}
		if (ts.isNewExpression(node.initializer)) {
			this.append_new_initializer(node.name.text, node.initializer, owner);
		}
	}

	/** Responsibilities: _resolution property ownership invocation_. **/
	private append_call_initializer(
		name: string,
		initializer: ts.CallExpression,
		owner: string
	): void {
		const call_owner = this.call_owner.call_owner(initializer.expression, owner);
		if (call_owner) {
			this.properties.set(`${owner}.${name}`, call_owner);
		}
	}

	/** Responsibilities: _resolution property ownership constructor_. **/
	private append_new_initializer(name: string, initializer: ts.NewExpression, owner: string): void {
		if (!ts.isIdentifier(initializer.expression)) {
			return;
		}
		this.properties.set(`${owner}.${name}`, initializer.expression.text);
	}

	/** Responsibilities: _classification AST node record_. **/
	private append(node: ts.Node, owner: string): void {
		if (ts.isPropertyDeclaration(node)) {
			if (node.type !== undefined) {
				this.append_named(node.name, owner, node.type);
			}
			this.append_initialized(node, owner);
			return;
		}
if (ts.isGetAccessorDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.type !== undefined) {
				this.append_named(node.name, owner, node.type);
			}
			return;
		}
		if (ts.isParameter(node)) {
			this.append_parameter(node, owner);
		}
	}

	/** Responsibilities: _initialization aliases invocation ownership_. **/
	public constructor(
		aliases: Map<string, string>,
		call_owner: CallOwnerResolver,
		instances: TypeScriptInstanceStore
	) {
		this.aliases = aliases;
		this.call_owner = call_owner;
		this.instances = instances;
		this.destructured_alias_collector = new TypeScriptDestructuredAliasCollector(
			this,
			call_owner,
			instances
		);
	}

	/** Responsibilities: _TypeScript tree traversal_. **/
	public append_tree(node: ts.Node, owner: string = ''): void {
		let current_owner = owner;
if (ts.isClassLike(node) && node.name) {
			current_owner = node.name.text;
		} else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
			current_owner = node.name.text;
		}
		if (current_owner) {
			this.append(node, current_owner);
		}
		ts.forEachChild(node, child => this.append_tree(child, current_owner));
	}

	/** Responsibilities: _retrieval recorded owner object_. **/
	public owner_for(owner: string, property: string): string {
			const property_owner = this.properties.get(`${owner}.${property}`);
			if (property_owner !== undefined) {
				return property_owner;
			}
			return '';
	}

	/** Responsibilities: _resolution instance owner named_. **/
	public instance_owner(name: string, node: ts.Node): string {
		const owner = this.instances.instance_owner(name, node);
		if (!owner) {
			return name;
		}
		return owner;
	}

	/** Responsibilities: _storage object property ownership_. **/
	public store_object_property(owner: string, property: string, property_owner: string): void {
		this.properties.set(`${owner}.${property}`, property_owner);
	}

	/** Responsibilities: _collection aliases introduced object_. **/
	public destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string = ''
	): readonly DestructuredAlias[] {
		return [...this.destructured_alias_collector.collect(
			pattern,
			source_file,
			initializer,
			current_owner
		)];
	}
}
