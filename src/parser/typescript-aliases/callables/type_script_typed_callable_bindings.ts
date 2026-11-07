import type { StringSetMap } from "src/analysis_types";
import type {
	TypeScriptCallableTypePropertiesContract,
	TypeScriptTypedCallableBindingsContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _typed callables_, _binding metadata_. **/
export class TypeScriptTypedCallableBindings implements TypeScriptTypedCallableBindingsContract {
	private readonly _objects: StringSetMap;
	private readonly _interfaces: StringSetMap;
	private readonly _type_properties: TypeScriptCallableTypePropertiesContract;

	/** Responsibilities: _inherited callable property extension_. **/
	private append_inherited_properties(properties: Set<string>, heritage: ts.ExpressionWithTypeArguments): void {
		if (!ts.isIdentifier(heritage.expression)) {
			return;
		}
		const inherited = this._interfaces.get(heritage.expression.text);
		if (inherited === undefined) {
			return;
		}
		for (const property of inherited) {
			properties.add(property);
		}
	}

	/** Responsibilities: _composite callable property extension_. **/
	private append_composite_part(properties: Set<string>, part: ts.TypeNode): void {
		if (ts.isTypeLiteralNode(part)) {
			for (const property of this._type_properties.object_properties(part)) {
				properties.add(property);
			}
			return;
		}
		if (!ts.isTypeReferenceNode(part) || !ts.isIdentifier(part.typeName)) {
			return;
		}
		const referenced = this._interfaces.get(part.typeName.text);
		if (referenced === undefined) {
			return;
		}
		for (const property of referenced) {
			properties.add(property);
		}
	}

	/** Responsibilities: _composite property collection_. **/
	private composite_properties(type: ts.UnionOrIntersectionTypeNode): Set<string> {
		const properties = new Set<string>();
		for (const part of type.types) {
			this.append_composite_part(properties, part);
		}
		return properties;
	}

	/** Responsibilities: _callable declaration property indexing_. **/
	private append_interface(node: ts.InterfaceDeclaration): void {
		const properties = this._type_properties.interface_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_inherited_properties(properties, heritage);
				}
			}
		}
		if (properties.size > 0) {
			this._interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _type alias property registration_. **/
	private type_alias_properties(alias_type: ts.TypeNode): Set<string> {
		if (ts.isTypeReferenceNode(alias_type) && ts.isIdentifier(alias_type.typeName)) {
			const properties = this._interfaces.get(alias_type.typeName.text);
			if (properties !== undefined) {
				return properties;
			}
		}
		if (ts.isTypeLiteralNode(alias_type)) {
			return this._type_properties.object_properties(alias_type);
		}
		if (ts.isIntersectionTypeNode(alias_type) || ts.isUnionTypeNode(alias_type)) {
			return this.composite_properties(alias_type);
		}
		return new Set<string>();
	}

	/** Responsibilities: _type alias property registration_. **/
	private append_type_alias(node: ts.TypeAliasDeclaration): void {
		const properties = this.type_alias_properties(node.type);
		if (properties.size > 0) {
			this._interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _class property registration_. **/
	private append_class(node: ts.ClassDeclaration): void {
		if (node.name === undefined) {
			return;
		}
		const properties = this._type_properties.class_properties(node);
		if (node.heritageClauses !== undefined) {
			for (const clause of node.heritageClauses) {
				for (const heritage of clause.types) {
					this.append_inherited_properties(properties, heritage);
				}
			}
		}
		if (properties.size > 0) {
			this._interfaces.set(node.name.text, properties);
		}
	}

	/** Responsibilities: _typed variable property resolution_. **/
	private variable_properties(variable_type: ts.TypeNode): Set<string> {
		if (ts.isTypeReferenceNode(variable_type) && ts.isIdentifier(variable_type.typeName)) {
			const properties = this._interfaces.get(variable_type.typeName.text);
			if (properties !== undefined) {
				return properties;
			}
		}
		if (ts.isTypeLiteralNode(variable_type)) {
			return this._type_properties.object_properties(variable_type);
		}
		return new Set<string>();
	}

	/** Responsibilities: _callable binding analysis initialization_. **/
	public constructor(
		objects: StringSetMap,
		interfaces: StringSetMap,
		type_properties: TypeScriptCallableTypePropertiesContract,
	) {
		this._objects = objects;
		this._interfaces = interfaces;
		this._type_properties = type_properties;
	}

	/** Responsibilities: _callable declaration property indexing_. **/
	public declaration(node: ts.Node): void {
		if (ts.isInterfaceDeclaration(node)) {
			this.append_interface(node);
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_type_alias(node);
			return;
		}
		if (ts.isClassDeclaration(node)) {
			this.append_class(node);
		}
	}

	/** Responsibilities: _typed callable variable registration_. **/
	public variable(node: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(node.name)) {
			return;
		}
		if (node.type === undefined) {
			return;
		}
		const properties = this.variable_properties(node.type);
		if (properties.size > 0) {
			this._objects.set(node.name.text, properties);
		}
	}
}
