import ts from 'typescript';
import { TypeScriptTypedCallableBindings } from 'src/typescript-callable-aliases/typed-callable-bindings';

/** Responsibilities: _typed callable contract bindings_. **/
export class TypeScriptContractBindings {
	private readonly typed_bindings = new TypeScriptTypedCallableBindings();

	/** Responsibilities: _type contract registration_. **/
	private append_type(interfaces: Map<string, Set<string>>, node: ts.TypeAliasDeclaration): boolean {
		const known = interfaces.has(node.name.text);
		this.typed_bindings.type_alias_declaration(interfaces, node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _class contract registration_. **/
	private append_class(interfaces: Map<string, Set<string>>, node: ts.ClassDeclaration): boolean {
		if (node.name === undefined) {
			return false;
		}
		const known = interfaces.has(node.name.text);
		this.typed_bindings.class_declaration(interfaces, node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _interface contract registration_. **/
	public append_interface(interfaces: Map<string, Set<string>>, node: ts.InterfaceDeclaration): boolean {
		const known = interfaces.has(node.name.text);
		this.typed_bindings.interface_declaration(interfaces, node);
		if (known) {
			return false;
		}
		return interfaces.has(node.name.text);
	}

	/** Responsibilities: _typed callable contract registration_. **/
	public append(interfaces: Map<string, Set<string>>, node: ts.Node): boolean {
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
