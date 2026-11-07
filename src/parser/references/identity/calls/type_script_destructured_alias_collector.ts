import ts from "typescript";

import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import type {
	CallOwnerResolverContract,
	TypeScriptDestructuredAliasCollectorContract,
	TypeScriptDestructuredOwnerContext,
	TypeScriptInstanceStoreContract,
	TypeScriptPropertyStateContract,
} from "src/model/protocols";
import type { DestructuredAlias } from "src/model/types";
import { TypeScriptReferenceQueryKind } from "src/model/types";

/** Responsibilities: _destructured binding name resolution_, _nested owner propagation_. **/
export class TypeScriptDestructuredAliasCollector implements TypeScriptDestructuredAliasCollectorContract {
	private readonly _property_state: TypeScriptPropertyStateContract;
	private readonly _call_owner: CallOwnerResolverContract;
	private readonly _instances: TypeScriptInstanceStoreContract;

	/** Responsibilities: _resolution local name introduced_. **/
	private element_name(element: ts.BindingElement, binding_source: ts.SourceFile): string {
		if (element.propertyName) {
			return element.propertyName.getText(binding_source);
		}
		return element.name.getText(binding_source);
	}

	/** Responsibilities: _resolution owner destructured this-property_. **/
	private this_property_owner(request: TypeScriptDestructuredOwnerContext): string {
		const { initializer, current_owner } = request;
		if (!ts.isPropertyAccessExpression(initializer)) {
			return "";
		}
		if (initializer.expression.kind !== ts.SyntaxKind.ThisKeyword || current_owner.length === 0) {
			return "";
		}
		return this._property_state.property_owner({
			owner: current_owner,
			property: initializer.name.text,
			side: INSTANCE_PROPERTY_SIDE,
		});
	}

	/** Responsibilities: _resolution owner destructured object_. **/
	private object_owner(request: TypeScriptDestructuredOwnerContext): string {
		const { initializer, current_owner, pattern } = request;
		if (ts.isCallExpression(initializer)) {
			const resolution = this._call_owner.resolve_reference({
				kind: TypeScriptReferenceQueryKind.CallOwner,
				expression: initializer.expression,
				owner: current_owner,
			});
			return resolution.owner();
		}
		if (ts.isIdentifier(initializer)) {
			const owner = this._instances.instance_owner(initializer.text, pattern);
			if (owner.bound) {
				return owner.value;
			}
			return "";
		}
		return this.this_property_owner(request);
	}

	/** Responsibilities: _initialization instance owner collaborators_. **/
	public constructor(
		property_state: TypeScriptPropertyStateContract,
		call_owner: CallOwnerResolverContract,
		instances: TypeScriptInstanceStoreContract,
	) {
		this._property_state = property_state;
		this._call_owner = call_owner;
		this._instances = instances;
	}

	/** Responsibilities: _collection destructured binding alias_. **/
	public collect_element(
		element: ts.BindingElement,
		object_owner: string,
		element_source: ts.SourceFile,
	): readonly DestructuredAlias[] {
		if (!ts.isIdentifier(element.name)) {
			return [];
		}
		const property_owner = this._property_state.property_owner({
			owner: object_owner,
			property: this.element_name(element, element_source),
			side: INSTANCE_PROPERTY_SIDE,
		});
		if (property_owner.length === 0) {
			return [];
		}
		return [{ name: element.name.text, owner: property_owner }];
	}

	/** Responsibilities: _collection aliases object binding_. **/
	public collect(
		pattern: ts.ObjectBindingPattern,
		collection_source: ts.SourceFile,
		initializer: ts.Expression,
		current_owner = "",
	): readonly DestructuredAlias[] {
		const object_owner = this.object_owner({ pattern, initializer, current_owner });
		if (!object_owner) {
			return [];
		}
		const aliases: DestructuredAlias[] = [];
		for (const element of pattern.elements) {
			aliases.push(...this.collect_element(element, object_owner, collection_source));
		}
		return aliases;
	}
}
