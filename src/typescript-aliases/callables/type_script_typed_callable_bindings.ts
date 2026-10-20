import ts from "typescript";
import { TypeScriptCallableTypeProperties } from "src/typescript-aliases/callables/type_script_callable_type_properties";
import type { StringSetMap } from "src/analysis_types";
import type { TypeScriptCallableTypePropertiesContract, TypeScriptTypedCallableBindingsContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _typed callables_, _binding metadata_. **/
export class TypeScriptTypedCallableBindings implements TypeScriptTypedCallableBindingsContract {
	private readonly type_properties: TypeScriptCallableTypePropertiesContract;
	private readonly interfaces: StringSetMap;

	/** Responsibilities: _type reference property registration_. **/
	private append_reference(
		objects: StringSetMap,
		interfaces: StringSetMap,
		name: string,
		type: ts.TypeReferenceNode,
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
	private append_literal(objects: StringSetMap, name: string, type: ts.TypeLiteralNode): void {
		const properties = this.type_properties.object_properties(type);
		if (properties.size > 0) {
			objects.set(name, properties);
		}
	}

	/** Responsibilities: _type alias reference registration_. **/
	private append_type_reference(interfaces: StringSetMap, name: string, type: ts.TypeReferenceNode): void {
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
		interfaces: StringSetMap,
		heritage: ts.ExpressionWithTypeArguments,
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
		interfaces: StringSetMap,
		heritage: ts.ExpressionWithTypeArguments,
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
	private append_type_literal(interfaces: StringSetMap, name: string, type: ts.TypeLiteralNode): void {
		const properties = this.type_properties.object_properties(type);
		if (properties.size > 0) {
			interfaces.set(name, properties);
		}
	}

	/** Responsibilities: _composite callable property extension_. **/
	private append_composite_part(properties: Set<string>, interfaces: StringSetMap, type: ts.TypeNode): void {
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
	private append_composite(interfaces: StringSetMap, name: string, type: ts.UnionOrIntersectionTypeNode): void {
		const properties = new Set<string>();
		for (const part of type.types) {
			this.append_composite_part(properties, interfaces, part);
		}
		if (properties.size > 0) {
			interfaces.set(name, properties);
		}
	}

	/** Responsibilities: _interface property registration_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(interfaces: StringSetMap) {
		this.type_properties = new TypeScriptCallableTypeProperties();
		this.interfaces = interfaces;
	}
	/** Responsibilities: _public operation_. **/
	public interface_declaration(node: ts.InterfaceDeclaration): void {
		const properties = this.type_properties.interface_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_interface_base(properties, this.interfaces, heritage);
				}
			}
		}
		if (properties.size > 0) {
			this.interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _type alias property registration_. **/
	public type_alias_declaration(node: ts.TypeAliasDeclaration): void {
		if (ts.isIntersectionTypeNode(node.type)) {
			this.append_composite(this.interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isUnionTypeNode(node.type)) {
			this.append_composite(this.interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isTypeReferenceNode(node.type)) {
			this.append_type_reference(this.interfaces, node.name.text, node.type);
			return;
		}
		if (ts.isTypeLiteralNode(node.type)) {
			this.append_type_literal(this.interfaces, node.name.text, node.type);
		}
	}

	/** Responsibilities: _class property registration_. **/
	public class_declaration(node: ts.ClassDeclaration): void {
		if (node.name === undefined) {
			return;
		}
		const properties = this.type_properties.class_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_class_base(properties, this.interfaces, heritage);
				}
			}
		}
		if (properties.size > 0) {
			this.interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _typed callable variable registration_. **/
	public variable(objects: StringSetMap, interfaces: StringSetMap, node: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
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
