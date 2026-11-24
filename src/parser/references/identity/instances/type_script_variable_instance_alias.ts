import type { TypeScriptInstanceStoreContract, TypeScriptPropertyStateContract } from "src/model/protocols";
import type { DestructuredAlias } from "src/model/types";
import { TypeScriptReferenceQueryKind } from "src/model/types";
import type { TypeScriptVariableInstanceAliasOptions } from "src/parser/references/identity/instances/protocols";
import type { InstanceAliasResolversContract } from "src/types";
import type { TypeScriptCallReturnAnalysisContract } from "src/typescript_analysis_protocols";
import type { TypeScriptReferenceBindingContract } from "src/typescript_analysis_protocols";
import type { TypeScriptObjectPropertyCollectorContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _single variable alias classification_, _binding alias registration_. **/
export class TypeScriptVariableInstanceAlias {
	private readonly _node: ts.VariableDeclaration;
	private readonly _owner: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _instances: TypeScriptInstanceStoreContract;
	private readonly _properties: TypeScriptPropertyStateContract;
	private readonly _resolvers: InstanceAliasResolversContract;
	private readonly _object_properties: TypeScriptObjectPropertyCollectorContract;
	private readonly _reference_helpers: TypeScriptReferenceBindingContract;
	private readonly _call_return_analysis: TypeScriptCallReturnAnalysisContract;

	/** Responsibilities: _variable binding name collection_. **/
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

	/** Responsibilities: _destructured alias registration_. **/
	private append_destructured_bindings(aliases: readonly DestructuredAlias[]): void {
		const resolved_names = new Set(aliases.map((alias) => alias.name));
		for (const name of this.binding_names(this._node.name)) {
			if (!resolved_names.has(name)) {
				this._instances.add(name, "", this._node);
			}
		}
		for (const alias of aliases) {
			this._instances.add(alias.name, alias.owner, this._node);
		}
	}

	/** Responsibilities: _destructured initializer alias registration_. **/
	private append_destructured_initializer(binding_pattern: ts.BindingPattern, source_expression: ts.Expression): void {
		let aliases: readonly DestructuredAlias[] = [];
		if (ts.isObjectBindingPattern(binding_pattern)) {
			aliases = this._properties.destructured_aliases(
				binding_pattern,
				this._source_file,
				source_expression,
				this._owner,
			);
		}
		this.append_destructured_bindings(aliases);
	}

	/** Responsibilities: _call owner binding_. **/
	private append_call_owner(initializer: ts.CallExpression): boolean {
		const resolved_owner = this._resolvers
			.resolve_reference({
				kind: TypeScriptReferenceQueryKind.CallOrPropertyOwner,
				expression: initializer.expression,
				owner: this._owner,
			})
			.owner();
		if (!resolved_owner) {
			return false;
		}
		this._instances.add(this._node.name.getText(this._source_file), resolved_owner, this._node);
		return true;
	}

	/** Responsibilities: _identifier alias registration_. **/
	private append_reference_alias(identifier: ts.Identifier): boolean {
		const owner = this._instances.instance_owner(identifier.text, identifier);
		if (!owner.bound) {
			return false;
		}
		this._instances.add(this._node.name.getText(this._source_file), owner.value, this._node);
		return true;
	}

	/** Responsibilities: _instance alias registration_. **/
	private append_instance_alias(expression: ts.Expression): boolean {
		if (this._reference_helpers.new_instance(this._node, expression)) {
			return true;
		}
		this._object_properties.appended(this._node, expression);
		if (ts.isCallExpression(expression)) {
			return this.append_call_owner(expression);
		}
		return false;
	}

	/** Responsibilities: _reference owner resolution_, _instance alias recording_. **/
	public constructor(context: TypeScriptVariableInstanceAliasOptions) {
		this._node = context.node;
		this._owner = context.owner;
		this._source_file = context.source_file;
		this._instances = context.instances;
		this._properties = context.properties;
		this._resolvers = context.resolvers;
		this._object_properties = context.object_properties;
		this._reference_helpers = context.reference_helpers;
		this._call_return_analysis = context.call_return_analysis;
	}

	/** Responsibilities: _variable initializer alias registration_. **/
	public append_initializer(initializer: ts.Expression): boolean {
		const binding_name = this._node.name;
		if (ts.isObjectBindingPattern(binding_name) || ts.isArrayBindingPattern(binding_name)) {
			this.append_destructured_initializer(binding_name, initializer);
			return true;
		}
		const name_is_id = ts.isIdentifier(binding_name);
		const value_is_id = ts.isIdentifier(initializer);
		if (name_is_id && value_is_id) {
			const alias_recorded = this.append_reference_alias(initializer);
			if (alias_recorded) {
				return true;
			}
		}
		return this.append_instance_alias(initializer);
	}

	/** Responsibilities: _declared variable alias registration_. **/
	public append_declared_type(): boolean {
		if (this._node.type === undefined) {
			return false;
		}
		const type_name = this._reference_helpers.resolved_reference_name(this._node.type);
		if (!type_name) {
			return false;
		}
		this._instances.add(this._node.name.getText(this._source_file), type_name, this._node);
		return true;
	}

	/** Responsibilities: _unresolved variable alias registration_. **/
	public append_unresolved(): void {
		for (const name of this.binding_names(this._node.name)) {
			this._instances.add(name, "", this._node);
		}
	}

	/** Responsibilities: _variable alias classification_. **/
	public append(): void {
		const source_initializer = this._node.initializer;
		if (source_initializer !== undefined) {
			const initializer = this._call_return_analysis.unwrapped_expression(source_initializer);
			if (this.append_initializer(initializer)) {
				return;
			}
		}
		if (this.append_declared_type()) {
			return;
		}
		this.append_unresolved();
	}
}
