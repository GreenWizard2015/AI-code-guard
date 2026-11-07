import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import ts from "typescript";

import type { TypeScriptPropertyStateContract } from "src/model/protocols";
import type { TypeScriptInstanceStoreContract } from "src/model/protocols";
import type { TypeScriptObjectPropertyCollectorContract } from "src/typescript_runtime_protocols";

import type { CallableExpressionUnwrapper, PropertyOwner } from "src/types";

/** Responsibilities: _object property owners resolution_, _property ownership state storage_. **/
export class TypeScriptObjectPropertyCollector implements TypeScriptObjectPropertyCollectorContract {
	private readonly _aliases: Map<string, string>;
	private readonly _property_state: TypeScriptPropertyStateContract;
	private readonly _instances: TypeScriptInstanceStoreContract;
	private readonly _unwrap: CallableExpressionUnwrapper;
	/** Responsibilities: _storage object property owner_. **/
	private store_property(owner_declaration: ts.VariableDeclaration, entry: PropertyOwner): void {
		if (!ts.isIdentifier(owner_declaration.name)) {
			return;
		}
		this._property_state.store_object_property(
			{ owner: owner_declaration.name.text, property: entry.property_name, side: INSTANCE_PROPERTY_SIDE },
			entry.owner,
		);
	}

	/** Responsibilities: _resolution owner creation new_. **/
	private new_owner(value: ts.NewExpression, property_name: string): PropertyOwner[] {
		if (!ts.isIdentifier(value.expression)) {
			return [];
		}
		const owner = this._aliases.get(value.expression.text);
		if (owner === undefined) {
			return [{ property_name, owner: value.expression.text }];
		}
		return [{ property_name, owner }];
	}

	/** Responsibilities: _resolution identifier property owner_. **/
	private identifier_owner(
		value: ts.Identifier,
		owner_declaration: ts.VariableDeclaration,
		property_name: string,
	): PropertyOwner[] {
		const owner = this._instances.instance_owner(value.text, owner_declaration);
		if (owner.bound && owner.value.length > 0) {
			return [{ property_name, owner: owner.value }];
		}
		return [{ property_name, owner: value.text }];
	}

	/** Responsibilities: _initialization aliases property state_, _expression unwrapping initialization_. **/
	public constructor(
		aliases: Map<string, string>,
		property_state: TypeScriptPropertyStateContract,
		instances: TypeScriptInstanceStoreContract,
		unwrap: CallableExpressionUnwrapper,
	) {
		this._aliases = aliases;
		this._property_state = property_state;
		this._instances = instances;
		this._unwrap = unwrap;
	}

	/** Responsibilities: _resolution owners object property_. **/
	public owner_for(variable_owner: ts.VariableDeclaration, property: ts.ObjectLiteralElementLike): PropertyOwner[] {
		if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
			return [];
		}
		const values = this._unwrap(property.initializer);
		const value = values.at(0);
		if (value === undefined) {
			return [];
		}
		if (ts.isIdentifier(value)) {
			return this.identifier_owner(value, variable_owner, property.name.text);
		}
		if (!ts.isNewExpression(value) || !ts.isIdentifier(value.expression)) {
			return [];
		}
		return this.new_owner(value, property.name.text);
	}

	/** Responsibilities: _aggregation owners object initializer_. **/
	public appended(appended_declaration: ts.VariableDeclaration, initializer: ts.Expression): boolean {
		if (!ts.isObjectLiteralExpression(initializer) || !ts.isIdentifier(appended_declaration.name)) {
			return false;
		}
		for (const property of initializer.properties) {
			const entries = this.owner_for(appended_declaration, property);
			for (const entry of entries) {
				this.store_property(appended_declaration, entry);
				break;
			}
		}
		return true;
	}
}
