import ts from 'typescript';
import { TypeScriptCallableTypeProperties } from 'src/typescript-callable-aliases/callable-type-properties';

/** Responsibilities: _typed callable object bindings_. **/
export class TypeScriptTypedCallableBindings {
	private readonly type_properties = new TypeScriptCallableTypeProperties();

	/** Responsibilities: _type reference property registration_. **/
	private append_reference(
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		name: string,
		type: ts.TypeReferenceNode
	): void {
		if (!ts.isIdentifier(type.typeName)) {
			return;
		}
		const properties = interfaces.get(type.typeName.text);
		if (properties !== undefined) {
			objects.set(name, properties);
		}
	}

	/** Responsibilities: _type literal property registration_. **/
	private append_literal(
		objects: Map<string, Set<string>>,
		name: string,
		type: ts.TypeLiteralNode
	): void {
		const properties = this.type_properties.object_properties(type);
		if (properties.size > 0) {
			objects.set(name, properties);
		}
	}

	/** Responsibilities: _type alias reference registration_. **/
	private append_type_reference(
		interfaces: Map<string, Set<string>>,
		name: string,
		type: ts.TypeReferenceNode
	): void {
		if (!ts.isIdentifier(type.typeName)) {
			return;
		}
		const properties = interfaces.get(type.typeName.text);
		if (properties !== undefined) {
			interfaces.set(name, properties);
		}
	}

	/** Responsibilities: _interface inherited property extension_. **/
	private append_interface_base(
		properties: Set<string>,
		interfaces: Map<string, Set<string>>,
		heritage: ts.ExpressionWithTypeArguments
	): void {
		if (!ts.isIdentifier(heritage.expression)) {
			return;
		}
		const inherited = interfaces.get(heritage.expression.text);
		if (inherited === undefined) {
			return;
		}
		for (const property of inherited) {
			properties.add(property);
		}
	}

	/** Responsibilities: _class inherited property extension_. **/
	private append_class_base(
		properties: Set<string>,
		interfaces: Map<string, Set<string>>,
		heritage: ts.ExpressionWithTypeArguments
	): void {
		if (!ts.isIdentifier(heritage.expression)) {
			return;
		}
		const inherited = interfaces.get(heritage.expression.text);
		if (inherited === undefined) {
			return;
		}
		for (const property of inherited) {
			properties.add(property);
		}
	}

	/** Responsibilities: _type alias literal registration_. **/
	private append_type_literal(
		interfaces: Map<string, Set<string>>,
		name: string,
		type: ts.TypeLiteralNode
	): void {
		const properties = this.type_properties.object_properties(type);
		if (properties.size > 0) {
			interfaces.set(name, properties);
		}
	}

	/** Responsibilities: _composite callable property extension_. **/
	private append_composite_part(
		properties: Set<string>,
		interfaces: Map<string, Set<string>>,
		type: ts.TypeNode
	): void {
		if (ts.isTypeLiteralNode(type)) {
			for (const property of this.type_properties.object_properties(type)) {
				properties.add(property);
			}
			return;
		}
		if (!ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) {
			return;
		}
		const referenced = interfaces.get(type.typeName.text);
		if (referenced === undefined) {
			return;
		}
		for (const property of referenced) {
			properties.add(property);
		}
	}

	/** Responsibilities: _composite property registration_. **/
	private append_composite(
		interfaces: Map<string, Set<string>>,
		name: string,
		type: ts.UnionOrIntersectionTypeNode
	): void {
		const properties = new Set<string>();
		for (const part of type.types) {
			this.append_composite_part(properties, interfaces, part);
		}
		if (properties.size > 0) {
			interfaces.set(name, properties);
		}
	}

	/** Responsibilities: _interface property registration_. **/
	public interface_declaration(interfaces: Map<string, Set<string>>, node: ts.InterfaceDeclaration): void {
		const properties = this.type_properties.interface_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_interface_base(properties, interfaces, heritage);
				}
			}
		}
		if (properties.size > 0) {
			interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _type alias property registration_. **/
	public type_alias_declaration(interfaces: Map<string, Set<string>>, node: ts.TypeAliasDeclaration): void {
		if (ts.isIntersectionTypeNode(node.type)) {
			this.append_composite(interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isUnionTypeNode(node.type)) {
			this.append_composite(interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isTypeReferenceNode(node.type)) {
			this.append_type_reference(interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isTypeLiteralNode(node.type)) {
			this.append_type_literal(interfaces, node.name.text, node.type);
		}
	}

	/** Responsibilities: _class property registration_. **/
	public class_declaration(interfaces: Map<string, Set<string>>, node: ts.ClassDeclaration): void {
		if (node.name === undefined) {
			return;
		}
		const properties = this.type_properties.class_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_class_base(properties, interfaces, heritage);
				}
			}
		}
		if (properties.size > 0) {
			interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _typed callable variable registration_. **/
	public variable(
		objects: Map<string, Set<string>>,
		interfaces: Map<string, Set<string>>,
		node: ts.VariableDeclaration
	): void {
		if (!ts.isIdentifier(node.name) || node.type === undefined) {
			return;
		}
		if (ts.isTypeReferenceNode(node.type)) {
			this.append_reference(objects, interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isTypeLiteralNode(node.type)) {
			this.append_literal(objects, node.name.text, node.type);
		}
	}
}
