import type { StringSetMap } from "src/analysis_types";
import type { TypeScriptCallableTypeBindingsContract } from "src/linting/test-support/protocols";
import type { TypeScriptTypedCallableBindingsContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _contract names_, _type associations_. **/
export class TypeScriptCallableTypeBindings implements TypeScriptCallableTypeBindingsContract {
	private readonly _interfaces: StringSetMap;
	private readonly _bindings: TypeScriptTypedCallableBindingsContract;

	/** Responsibilities: _type contract registration_. **/
	private append_type(node: ts.TypeAliasDeclaration): boolean {
		const known = this._interfaces.has(node.name.text);
		this._bindings.declaration(node);
		if (known) {
			return false;
		}
		return this._interfaces.has(node.name.text);
	}

	/** Responsibilities: _class contract registration_. **/
	private append_class(node: ts.ClassDeclaration): boolean {
		if (node.name === undefined) {
			return false;
		}
		const known = this._interfaces.has(node.name.text);
		this._bindings.declaration(node);
		if (known) {
			return false;
		}
		return this._interfaces.has(node.name.text);
	}

	/** Responsibilities: _typed contract binding initialization_. **/
	public constructor(interfaces: StringSetMap, bindings: TypeScriptTypedCallableBindingsContract) {
		this._interfaces = interfaces;
		this._bindings = bindings;
	}

	/** Responsibilities: _interface contract registration_. **/
	public append_interface(node: ts.InterfaceDeclaration): boolean {
		const known = this._interfaces.has(node.name.text);
		this._bindings.declaration(node);
		if (known) {
			return false;
		}
		return this._interfaces.has(node.name.text);
	}

	/** Responsibilities: _typed callable contract registration_. **/
	public append(node: ts.Node): boolean {
		if (ts.isInterfaceDeclaration(node)) {
			return this.append_interface(node);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			return this.append_type(node);
		}
		if (!ts.isClassDeclaration(node)) {
			return false;
		}
		return this.append_class(node);
	}
}
