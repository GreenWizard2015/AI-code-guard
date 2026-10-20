import ts from "typescript";
import { TypeScriptTypedCallableBindings } from "src/typescript-aliases/callables/type_script_typed_callable_bindings";
import type { StringSetMap } from "src/analysis_types";
import type { TypeScriptContractBindingsContract, TypeScriptTypedCallableBindingsContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _contract names_, _type associations_. **/
export class TypeScriptContractBindings implements TypeScriptContractBindingsContract {
	/** Responsibilities: _type contract registration_. **/
	private append_type(interfaces: StringSetMap, node: ts.TypeAliasDeclaration): boolean {
		const known = interfaces.has(node.name.text);
		const bindings: TypeScriptTypedCallableBindingsContract = new TypeScriptTypedCallableBindings(interfaces);
		bindings.type_alias_declaration(node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _class contract registration_. **/
	private append_class(interfaces: StringSetMap, node: ts.ClassDeclaration): boolean {
		if (node.name === undefined) {
			return false;
		}
		const known = interfaces.has(node.name.text);
		const bindings: TypeScriptTypedCallableBindingsContract = new TypeScriptTypedCallableBindings(interfaces);
		bindings.class_declaration(node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _interface contract registration_. **/
	public append_interface(interfaces: StringSetMap, node: ts.InterfaceDeclaration): boolean {
		const known = interfaces.has(node.name.text);
		const bindings: TypeScriptTypedCallableBindingsContract = new TypeScriptTypedCallableBindings(interfaces);
		bindings.interface_declaration(node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _typed callable contract registration_. **/
	public append(interfaces: StringSetMap, node: ts.Node): boolean {
		if (ts.isInterfaceDeclaration(node)) {
			return this.append_interface(interfaces, node);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			return this.append_type(interfaces, node);
		}
		if (!ts.isClassDeclaration(node)) {
			return false;
		}
		return this.append_class(interfaces, node);
	}
}
