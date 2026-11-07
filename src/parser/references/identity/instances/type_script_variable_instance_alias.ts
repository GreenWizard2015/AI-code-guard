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

	/** Responsibilities: _destructured variable alias registration_. **/
	private append_destructured(): boolean {
		const source_initializer = this._node.initializer;
		if (source_initializer === undefined) {
			return false;
		}
		const initializer = this._call_return_analysis.unwrapped_expression(source_initializer);
		if (!ts.isObjectBindingPattern(this._node.name) && !ts.isArrayBindingPattern(this._node.name)) {
			return false;
		}
		let aliases: readonly DestructuredAlias[] = [];
		if (ts.isObjectBindingPattern(this._node.name)) {
			aliases = this._properties.destructured_aliases(this._node.name, this._source_file, initializer, this._owner);
		}
		this.append_destructured_bindings(aliases);
		return true;
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

	/** Responsibilities: _instance alias recording_. **/
	private append_constructed(): boolean {
		const source_initializer = this._node.initializer;
		if (source_initializer === undefined) {
			return false;
		}
		const initializer = this._call_return_analysis.unwrapped_expression(source_initializer);
		if (this._reference_helpers.new_instance(this._node, initializer)) {
			return true;
		}
		this._object_properties.appended(this._node, initializer);
		return false;
	}

	/** Responsibilities: _reference variable alias registration_. **/
	private append_reference_alias(): boolean {
		const source_initializer = this._node.initializer;
		if (source_initializer === undefined) {
			return false;
		}
		const initializer = this._call_return_analysis.unwrapped_expression(source_initializer);
		if (!ts.isIdentifier(this._node.name) || !ts.isIdentifier(initializer)) {
			return false;
		}
		const owner = this._instances.instance_owner(initializer.text, initializer);
		if (!owner.bound) {
			return false;
		}
		this._instances.add(this._node.name.text, owner.value, this._node);
		return true;
	}

	/** Responsibilities: _call-based variable alias registration_. **/
	private append_call(): boolean {
		const source_initializer = this._node.initializer;
		if (source_initializer === undefined) {
			return false;
		}
		const initializer = this._call_return_analysis.unwrapped_expression(source_initializer);
		if (!ts.isCallExpression(initializer)) {
			return false;
		}
		return this.append_call_owner(initializer);
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
	public append_initializer(): boolean {
		if (this.append_destructured()) {
			return true;
		}
		if (this.append_reference_alias()) {
			return true;
		}
		if (this.append_constructed()) {
			return true;
		}
		return false;
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
		if (this.append_initializer()) {
			return;
		}
		if (this.append_call() || this.append_declared_type()) {
			return;
		}
		this.append_unresolved();
	}
}
