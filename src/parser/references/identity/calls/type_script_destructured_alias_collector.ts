import ts from "typescript";

import type {
	TypeScriptDestructuredAliasCollectorContract,
	TypeScriptInstanceStoreContract,
} from "src/model/protocols";
import type { CallOwnerResolverContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import type { DestructuredAlias } from "src/model/types";
import { INSTANCE_PROPERTY_SIDE } from "src/parser/references/constants";

/** Responsibilities: _destructured binding name resolution_, _nested owner propagation_. **/
export class TypeScriptDestructuredAliasCollector implements TypeScriptDestructuredAliasCollectorContract {
	private readonly property_state: TypeScriptPropertyStateContract;
	private readonly call_owner: CallOwnerResolverContract;
	private readonly instances: TypeScriptInstanceStoreContract;

	/** Responsibilities: _resolution local name introduced_. **/
	private element_name(element: ts.BindingElement, source_file: ts.SourceFile): string {
		if (element.propertyName) {
			return element.propertyName.getText(source_file);
		}
		return element.name.getText(source_file);
	}

	/** Responsibilities: _resolution owner destructured this-property_. **/
	private this_property_owner(initializer: ts.Expression, current_owner: string): string {
		if (!ts.isPropertyAccessExpression(initializer)) {
			return "";
		}
		if (initializer.expression.kind !== ts.SyntaxKind.ThisKeyword || current_owner.length === 0) {
			return "";
		}
		return this.property_state.property_owner(current_owner, initializer.name.text, INSTANCE_PROPERTY_SIDE);
	}

	/** Responsibilities: _resolution owner destructured object_. **/
	private object_owner(initializer: ts.Expression, current_owner: string, pattern: ts.ObjectBindingPattern): string {
		if (ts.isCallExpression(initializer)) {
			const owner = this.call_owner.call_owner(initializer.expression, current_owner);
			if (owner !== undefined) {
				return owner;
			}
			return "";
		}
		if (ts.isIdentifier(initializer)) {
			const owner = this.instances.instance_owner(initializer.text, pattern);
			if (owner.bound) {
				return owner.value;
			}
			return "";
		}
		return this.this_property_owner(initializer, current_owner);
	}

	/** Responsibilities: _initialization instance owner collaborators_. **/
	public constructor(
		property_state: TypeScriptPropertyStateContract,
		call_owner: CallOwnerResolverContract,
		instances: TypeScriptInstanceStoreContract,
	) {
		this.property_state = property_state;
		this.call_owner = call_owner;
		this.instances = instances;
	}

	/** Responsibilities: _collection destructured binding alias_. **/
	public collect_element(
		element: ts.BindingElement,
		object_owner: string,
		source_file: ts.SourceFile,
	): readonly DestructuredAlias[] {
		if (!ts.isIdentifier(element.name)) {
			return [];
		}
		const property_owner = this.property_state.property_owner(
			object_owner,
			this.element_name(element, source_file),
			INSTANCE_PROPERTY_SIDE,
		);
		if (property_owner.length === 0) {
			return [];
		}
		return [{ name: element.name.text, owner: property_owner }];
	}

	/** Responsibilities: _collection aliases object binding_. **/
	public collect(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string = "",
	): readonly DestructuredAlias[] {
		const object_owner = this.object_owner(initializer, current_owner, pattern);
		if (!object_owner) {
			return [];
		}
		const aliases: DestructuredAlias[] = [];
		for (const element of pattern.elements) {
			aliases.push(...this.collect_element(element, object_owner, source_file));
		}
		return aliases;
	}
}
