import ts from 'typescript';

import type { TypeScriptPropertyState } from 'src/model/typescript-property-state';

import type { ExpressionUnwrapper, PropertyOwner } from 'src/types';

/** Responsibilities: _object property owners resolution_, _property ownership state storage_. **/
export class TypeScriptObjectPropertyCollector {
	private readonly aliases: Map<string, string>;
	private readonly property_state: TypeScriptPropertyState;
	private readonly unwrap: ExpressionUnwrapper;
	/** Responsibilities: _storage object property owner_. **/
	private store_property(node: ts.VariableDeclaration, entry: PropertyOwner): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		this.property_state.store_object_property(node.name.text, entry.property_name, entry.owner);
	}

	/** Responsibilities: _resolution owner creation new_. **/
	private new_owner(value: ts.NewExpression, property_name: string): PropertyOwner[] {
		if (!ts.isIdentifier(value.expression)) {
			return [];
		}
		const owner = this.aliases.get(value.expression.text);
		if (owner === undefined) {
			return [{ property_name, owner: value.expression.text }];
		}
		return [{ property_name, owner }];
	}

	/** Responsibilities: _initialization aliases property state_, _expression unwrapping initialization_. **/
	public constructor(
		aliases: Map<string, string>,
		property_state: TypeScriptPropertyState,
		unwrap: ExpressionUnwrapper
	) {
		this.aliases = aliases;
		this.property_state = property_state;
		this.unwrap = unwrap;
	}

	/** Responsibilities: _resolution owners object property_. **/
	public owner_for(
		node: ts.VariableDeclaration,
		property: ts.ObjectLiteralElementLike
	): PropertyOwner[] {
if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
			return [];
		}
		const values = this.unwrap(property.initializer);
		if (values.length === 0) {
			return [];
		}
		const value = values[0];
		if (ts.isIdentifier(value)) {
			return [{ property_name: property.name.text, owner: this.property_state.instance_owner(value.text, node) }];
		}
if (!ts.isNewExpression(value) || !ts.isIdentifier(value.expression)) {
			return [];
		}
		return this.new_owner(value, property.name.text);
	}

	/** Responsibilities: _aggregation owners object initializer_. **/
	public appended(node: ts.VariableDeclaration, initializer: ts.Expression): boolean {
if (!ts.isObjectLiteralExpression(initializer) || !ts.isIdentifier(node.name)) {
			return false;
		}
		for (const property of initializer.properties) {
			const entries = this.owner_for(node, property);
			if (entries.length > 0) {
				this.store_property(node, entries[0]);
			}
		}
		return true;
	}
}
