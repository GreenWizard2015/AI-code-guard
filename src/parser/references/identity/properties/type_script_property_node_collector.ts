import { INSTANCE_PROPERTY_SIDE, STATIC_PROPERTY_SIDE } from "src/constants";
import type { CallOwnerResolverContract, TypeScriptPropertyContext } from "src/model/protocols";
import { TypeScriptReferenceQueryKind } from "src/model/types";
import { ConstructorRules } from "src/parser/analysis/constructor_rules";
import { DeclarationPredicates } from "src/parser/analysis/declaration_predicates";
import type {
	TypeScriptPropertyNodeCollectorContract,
	TypeScriptPropertyNodeCollectorOptions,
} from "src/parser/references/identity/properties/protocols";
import type { TypeScriptReferenceBindingContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _property declaration ownership_, _initializer owner resolution_. **/
export class TypeScriptPropertyNodeCollector implements TypeScriptPropertyNodeCollectorContract {
	private readonly _properties: Map<string, string>;
	private readonly _reference_binding: TypeScriptReferenceBindingContract;
	private readonly _call_owner: CallOwnerResolverContract;
	private readonly _declaration_predicates: DeclarationPredicates;

	/** Responsibilities: _typed parameter property recording_. **/
	private append_parameter(
		parameter_node: ts.ParameterDeclaration,
		parameter_context: TypeScriptPropertyContext,
	): void {
		if (!ts.isIdentifier(parameter_node.name)) {
			return;
		}
		if (parameter_node.type !== undefined) {
			this.append_named(parameter_node.name, parameter_node.type, parameter_context);
		}
		this.append_initialized(parameter_node, parameter_context);
	}

	/** Responsibilities: _named property state_. **/
	private append_named(name: ts.PropertyName, type: ts.TypeNode, named_context: TypeScriptPropertyContext): void {
		if (!ts.isIdentifier(name)) {
			return;
		}
		const type_name = this._reference_binding.resolved_reference_name(type);
		if (type_name) {
			this._properties.set(JSON.stringify([named_context.side, named_context.owner, name.text]), type_name);
		}
	}

	/** Responsibilities: _property initializer classification_. **/
	private append_initialized(initialized_node: ts.Node, initializer_context: TypeScriptPropertyContext): void {
		if (!ts.isPropertyDeclaration(initialized_node) && !ts.isParameter(initialized_node)) {
			return;
		}
		if (!initialized_node.initializer || !ts.isIdentifier(initialized_node.name)) {
			return;
		}
		if (ts.isCallExpression(initialized_node.initializer)) {
			this.append_call_initializer(initialized_node.name.text, initialized_node.initializer, initializer_context);
			return;
		}
		if (ts.isNewExpression(initialized_node.initializer)) {
			this.append_new_initializer(initialized_node.name.text, initialized_node.initializer, initializer_context);
		}
	}

	/** Responsibilities: _call initializer ownership_. **/
	private append_call_initializer(
		name: string,
		initializer: ts.CallExpression,
		call_context: TypeScriptPropertyContext,
	): void {
		const resolution = this._call_owner.resolve_reference({
			kind: TypeScriptReferenceQueryKind.CallOwner,
			expression: initializer.expression,
			owner: call_context.owner,
		});
		const owner = resolution.owner();
		if (owner) {
			this._properties.set(JSON.stringify([call_context.side, call_context.owner, name]), owner);
		}
	}

	/** Responsibilities: _constructor initializer ownership_. **/
	private append_new_initializer(
		name: string,
		initializer: ts.NewExpression,
		new_context: TypeScriptPropertyContext,
	): void {
		const owner = this._reference_binding.new_expression_owner(initializer);
		if (owner.length > 0) {
			this._properties.set(JSON.stringify([new_context.side, new_context.owner, name]), owner);
		}
	}

	/** Responsibilities: _property declaration recording_. **/
	private append_property(property_node: ts.PropertyDeclaration, declaration_context: TypeScriptPropertyContext): void {
		const property_context = this.property_context(property_node, declaration_context);
		if (property_node.type !== undefined) {
			this.append_named(property_node.name, property_node.type, property_context);
		}
		this.append_initialized(property_node, property_context);
	}

	/** Responsibilities: _property signature recording_. **/
	private append_signature(signature_node: ts.Node, signature_context: TypeScriptPropertyContext): boolean {
		if (ts.isGetAccessorDeclaration(signature_node)) {
			const getter_context = this.property_context(signature_node, signature_context);
			if (signature_node.type !== undefined) {
				this.append_named(signature_node.name, signature_node.type, getter_context);
			}
			return true;
		}
		if (!ts.isPropertySignature(signature_node)) {
			return false;
		}
		if (signature_node.type !== undefined) {
			this.append_named(signature_node.name, signature_node.type, {
				owner: signature_context.owner,
				side: INSTANCE_PROPERTY_SIDE,
			});
		}
		return true;
	}

	/** Responsibilities: _property-side context creation_. **/
	private property_context(node: ts.Node, base: TypeScriptPropertyContext): TypeScriptPropertyContext {
		let is_static = false;
		if (ts.canHaveModifiers(node)) {
			const modifiers = ts.getModifiers(node);
			if (modifiers !== undefined) {
				is_static = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
			}
		}
		let side = INSTANCE_PROPERTY_SIDE;
		if (is_static) {
			side = STATIC_PROPERTY_SIDE;
		}
		return { owner: base.owner, side };
	}

	/** Responsibilities: _property node collector initialization_. **/
	public constructor(options: TypeScriptPropertyNodeCollectorOptions) {
		this._properties = options.properties;
		this._reference_binding = options.reference_binding;
		this._call_owner = options.call_owner;
		this._declaration_predicates = new DeclarationPredicates(new ConstructorRules());
	}

	/** Responsibilities: _property owner context_. **/
	public owner_context(owner_node: ts.Node, inherited_context: TypeScriptPropertyContext): TypeScriptPropertyContext {
		if (ts.isClassLike(owner_node)) {
			if (owner_node.name !== undefined) {
				return { owner: owner_node.name.text, side: inherited_context.side };
			}
			return inherited_context;
		}
		if (ts.isInterfaceDeclaration(owner_node) || ts.isTypeAliasDeclaration(owner_node)) {
			return { owner: owner_node.name.text, side: inherited_context.side };
		}
		return inherited_context;
	}

	/** Responsibilities: _property node dispatch_. **/
	public append_node(visited_node: ts.Node, append_context: TypeScriptPropertyContext): void {
		if (ts.isPropertyDeclaration(visited_node)) {
			this.append_property(visited_node, append_context);
			return;
		}
		if (this.append_signature(visited_node, append_context)) {
			return;
		}
		if (!ts.isParameter(visited_node)) {
			return;
		}
		if (this._declaration_predicates.parameter_property(visited_node)) {
			this.append_parameter(visited_node, append_context);
		}
	}
}
