import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";
import { TypeScriptDestructuredAliasCollector } from "src/parser/references/identity/calls/type_script_destructured_alias_collector";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import type { DestructuredAlias } from "src/model/types";
import type { TypeScriptPropertySide } from "src/types";
import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/parser/references/constants";
import ts from "typescript";

import type {
	TypeScriptDestructuredAliasCollectorContract,
	TypeScriptInstanceStoreContract,
	TypeScriptPropertyStateContract,
} from "src/model/protocols";
import type { CallOwnerResolverContract } from "src/model/protocols";

/** Responsibilities: _property owner collection_, _destructured property alias tracking_. **/
export class TypeScriptPropertyState implements TypeScriptPropertyStateContract {
	private readonly aliases: Map<string, string>;
	private readonly call_owner: CallOwnerResolverContract;
	private readonly destructured_alias_collector: TypeScriptDestructuredAliasCollectorContract;
	private readonly properties: Map<string, string>;
	private readonly reference_binding: TypeScriptReferenceBinding;
	private readonly declaration_predicates: DeclarationPredicates;

	/** Responsibilities: _typed parameter property recording_. **/
	private append_parameter(node: ts.ParameterDeclaration, owner: string): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		const parameter_name = node.name;
		const parameter_type = node.type;
		if (parameter_type !== undefined) {
			this.append_named(parameter_name, owner, parameter_type, INSTANCE_PROPERTY_SIDE);
		}
		this.append_initialized(node, owner, INSTANCE_PROPERTY_SIDE);
	}

	/** Responsibilities: _named property state_. **/
	private append_named(name: ts.PropertyName, owner: string, type: ts.TypeNode, side: TypeScriptPropertySide): void {
		if (!ts.isIdentifier(name)) {
			return;
		}
		const type_name = this.reference_binding.resolved_reference_name(type, this.aliases);
		if (type_name) {
			this.properties.set(`${side}.${owner}.${name.text}`, type_name);
		}
	}

	/** Responsibilities: _inspection initialization property declaration_. **/
	private append_initialized(node: ts.Node, owner: string, side: TypeScriptPropertySide): void {
		if (!ts.isPropertyDeclaration(node) && !ts.isParameter(node)) {
			return;
		}
		if (!node.initializer || !ts.isIdentifier(node.name)) {
			return;
		}
		if (ts.isCallExpression(node.initializer)) {
			this.append_call_initializer(node.name.text, node.initializer, owner, side);
			return;
		}
		if (ts.isNewExpression(node.initializer)) {
			this.append_new_initializer(node.name.text, node.initializer, owner, side);
		}
	}

	/** Responsibilities: _resolution property ownership invocation_. **/
	private append_call_initializer(
		name: string,
		initializer: ts.CallExpression,
		owner: string,
		side: TypeScriptPropertySide,
	): void {
		const call_owner = this.call_owner.call_owner(initializer.expression, owner);
		if (call_owner) {
			this.properties.set(`${side}.${owner}.${name}`, call_owner);
		}
	}

	/** Responsibilities: _resolution property ownership constructor_. **/
	private append_new_initializer(
		name: string,
		initializer: ts.NewExpression,
		owner: string,
		side: TypeScriptPropertySide,
	): void {
		const property_owner = this.reference_binding.new_expression_owner(initializer, this.aliases);
		if (property_owner.length > 0) {
			this.properties.set(`${side}.${owner}.${name}`, property_owner);
		}
	}

	/** Responsibilities: _classification AST node record_. **/
	private append(node: ts.Node, owner: string): void {
		if (this.append_property(node, owner)) {
			return;
		}
		if (this.append_signature(node, owner)) {
			return;
		}
		if (ts.isParameter(node)) {
			if (this.declaration_predicates.parameter_property(node)) {
				this.append_parameter(node, owner);
			}
		}
	}

	/** Responsibilities: _property declaration ownership_. **/
	private append_property(node: ts.Node, owner: string): boolean {
		if (!ts.isPropertyDeclaration(node)) {
			return false;
		}
		let side: TypeScriptPropertySide = INSTANCE_PROPERTY_SIDE;
		if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword) === true) {
			side = STATIC_PROPERTY_SIDE;
		}
		if (node.type !== undefined) {
			this.append_named(node.name, owner, node.type, side);
		}
		this.append_initialized(node, owner, side);
		return true;
	}

	/** Responsibilities: _property signature ownership_. **/
	private append_signature(node: ts.Node, owner: string): boolean {
		if (ts.isGetAccessorDeclaration(node)) {
			let side: TypeScriptPropertySide = INSTANCE_PROPERTY_SIDE;
			if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword) === true) {
				side = STATIC_PROPERTY_SIDE;
			}
			if (node.type !== undefined) {
				this.append_named(node.name, owner, node.type, side);
			}
			return true;
		}
		if (!ts.isPropertySignature(node)) {
			return false;
		}
		if (node.type !== undefined) {
			this.append_named(node.name, owner, node.type, INSTANCE_PROPERTY_SIDE);
		}
		return true;
	}

	/** Responsibilities: _parameter property classification_. **/
	private parameter_property(node: ts.Node): boolean {
		if (!ts.isParameter(node)) {
			return false;
		}
		return this.declaration_predicates.parameter_property(node);
	}

	/** Responsibilities: _property owner resolution_. **/
	private owner_name(node: ts.Node, owner: string): string {
		if (ts.isClassLike(node)) {
			if (node.name !== undefined) {
				return node.name.text;
			}
			return owner;
		}
		if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
			return node.name.text;
		}
		return owner;
	}

	/** Responsibilities: _owned property state collection_. **/
	private append_property_node(node: ts.Node, owner: string): boolean {
		if (ts.isPropertyDeclaration(node)) {
			this.append(node, owner);
			return true;
		}
		return false;
	}

	/** Responsibilities: _owned parameter state collection_. **/
	private append_parameter_node(node: ts.Node, owner: string): boolean {
		if (this.parameter_property(node)) {
			this.append(node, owner);
			return true;
		}
		return false;
	}

	/** Responsibilities: _owned signature state collection_. **/
	private append_signature_node(node: ts.Node, owner: string): boolean {
		if (ts.isPropertySignature(node)) {
			this.append(node, owner);
			return true;
		}
		if (ts.isGetAccessorDeclaration(node)) {
			this.append(node, owner);
			return true;
		}
		return false;
	}

	/** Responsibilities: _owned property state collection_. **/
	private append_owned_node(node: ts.Node, owner: string): void {
		if (owner.length === 0) {
			return;
		}
		if (this.append_property_node(node, owner)) {
			return;
		}
		if (this.append_parameter_node(node, owner)) {
			return;
		}
		if (this.append_signature_node(node, owner)) {
			return;
		}
	}

	/** Responsibilities: _initialization aliases invocation ownership_. **/
	public constructor(
		aliases: Map<string, string>,
		call_owner: CallOwnerResolverContract,
		instances: TypeScriptInstanceStoreContract,
	) {
		this.properties = new Map<string, string>();
		this.reference_binding = new TypeScriptReferenceBinding();
		this.declaration_predicates = new DeclarationPredicates();
		this.aliases = aliases;
		this.call_owner = call_owner;
		this.destructured_alias_collector = new TypeScriptDestructuredAliasCollector(this, call_owner, instances);
	}

	/** Responsibilities: _TypeScript tree traversal_. **/
	public append_tree(node: ts.Node, owner: string = ""): void {
		const current_owner = this.owner_name(node, owner);
		this.append_owned_node(node, current_owner);
		ts.forEachChild(node, (child) => this.append_tree(child, current_owner));
	}

	/** Responsibilities: _lookup recorded property ownership_. **/
	public property_owner(
		owner: string,
		property: string,
		side: TypeScriptPropertySide,
	): string {
		const entry = this.properties.get(`${side}.${owner}.${property}`);
		if (entry === undefined) {
			return "";
		}
		return entry;
	}

	/** Responsibilities: _storage object property ownership_. **/
	public store_object_property(owner: string, property: string, property_owner: string): void {
		this.properties.set(`${INSTANCE_PROPERTY_SIDE}.${owner}.${property}`, property_owner);
	}

	/** Responsibilities: _collection aliases introduced object_. **/
	public destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string = "",
	): readonly DestructuredAlias[] {
		return [...this.destructured_alias_collector.collect(pattern, source_file, initializer, current_owner)];
	}
}
