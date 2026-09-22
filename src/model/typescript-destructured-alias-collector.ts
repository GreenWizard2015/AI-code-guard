import ts from 'typescript';

import type { TypeScriptInstanceStore } from 'src/model/protocols';
import type { TypeScriptPropertyState } from 'src/model/typescript-property-state';
import type { CallOwnerResolver } from 'src/model/protocols';
import type { DestructuredAlias } from 'src/model/types';

/** Responsibilities: _resolution owners TypeScript object_. **/
export class TypeScriptDestructuredAliasCollector {
	private readonly property_state: TypeScriptPropertyState;
	private readonly call_owner: CallOwnerResolver;
	private readonly instances: TypeScriptInstanceStore;

	/** Responsibilities: _resolution local name introduced_. **/
	private element_name(element: ts.BindingElement, source_file: ts.SourceFile): string {
		if (element.propertyName) {
			return element.propertyName.getText(source_file);
		}
		return element.name.getText(source_file);
	}

	/** Responsibilities: _resolution owner destructured this-property_. **/
	private this_property_owner(
		initializer: ts.Expression,
		current_owner: string
	): string {
		if (!ts.isPropertyAccessExpression(initializer)) {
			return '';
		}
if (initializer.expression.kind !== ts.SyntaxKind.ThisKeyword || current_owner.length === 0) {
			return '';
		}
		return this.property_state.owner_for(current_owner, initializer.name.text);
	}

	/** Responsibilities: _resolution owner destructured object_. **/
	private object_owner(
		initializer: ts.Expression,
		current_owner: string,
		pattern: ts.ObjectBindingPattern
	): string {
		if (ts.isCallExpression(initializer)) {
			const owner = this.call_owner.call_owner(initializer.expression, current_owner);
			if (owner !== undefined) {
				return owner;
			}
			return '';
		}
		if (ts.isIdentifier(initializer)) {
			const owner = this.instances.instance_owner(initializer.text, pattern);
			if (owner !== undefined) {
				return owner;
			}
			return '';
		}
		return this.this_property_owner(initializer, current_owner);
	}

	/** Responsibilities: _initialization instance owner collaborators_. **/
	public constructor(
		property_state: TypeScriptPropertyState,
		call_owner: CallOwnerResolver,
		instances: TypeScriptInstanceStore
	) {
		this.property_state = property_state;
		this.call_owner = call_owner;
		this.instances = instances;
	}

	/** Responsibilities: _collection destructured binding alias_. **/
	public collect_element(
		element: ts.BindingElement,
		object_owner: string,
		source_file: ts.SourceFile
	): readonly DestructuredAlias[] {
		if (!ts.isIdentifier(element.name)) {
			return [];
		}
		const property_owner = this.property_state.owner_for(
			object_owner,
			this.element_name(element, source_file)
		);
		if (!property_owner) {
			return [];
		}
		return [{ name: element.name.text, owner: property_owner }];
	}

	/** Responsibilities: _collection aliases object binding_. **/
	public collect(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string = ''
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
