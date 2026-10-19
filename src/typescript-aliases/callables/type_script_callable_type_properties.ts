import ts from "typescript";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { TypeScriptStaticKeyAliases } from "src/typescript-aliases/callables/type_script_static_key_aliases";
import type { TypeScriptCallableTypePropertiesContract, TypeScriptStaticKeyAliasesContract } from "src/protocols";

/** Responsibilities: _callable object property collection_, _class interface property collection_. **/
export class TypeScriptCallableTypeProperties implements TypeScriptCallableTypePropertiesContract {
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly callable_member_kinds: Set<ts.SyntaxKind>;
	private readonly static_key_aliases: TypeScriptStaticKeyAliasesContract;

	/** Responsibilities: _typed function property extension_. **/
	private append_function_property(properties: Set<string>, name: string, member: ts.PropertySignature): void {
		if (member.type === undefined) {
			return;
		}
		if (ts.isFunctionTypeNode(member.type)) {
			properties.add(name);
		}
	}

	/** Responsibilities: _typed callable property extension_. **/
	private append_property(properties: Set<string>, member: ts.TypeElement): void {
		if (member.name === undefined) {
			return;
		}
		const name = this.property_name(member.name);
		if (name.length === 0) {
			return;
		}
		if (this.callable_member_kinds.has(member.kind)) {
			properties.add(name);
			return;
		}
		if (!ts.isPropertySignature(member)) {
			return;
		}
		this.append_function_property(properties, name, member);
	}

	/** Responsibilities: _callable type property composition_. **/
	public constructor() {
		this.expression_names = new TypeScriptExpressionNames();
		this.callable_member_kinds = new Set([ts.SyntaxKind.MethodSignature]);
		this.static_key_aliases = new TypeScriptStaticKeyAliases();
	}

	/** Responsibilities: _typed property name resolution_. **/
	public property_name(name: ts.PropertyName): string {
		const literal_name = this.expression_names.static_property_name(name);
		if (literal_name !== "") {
			return literal_name;
		}
		if (ts.isComputedPropertyName(name)) {
			return this.static_key_aliases.value(name.expression, name);
		}
		return "";
	}

	/** Responsibilities: _type literal callable properties_. **/
	public object_properties(type: ts.TypeLiteralNode): Set<string> {
		const properties = new Set<string>();
		for (const member of type.members) {
			this.append_property(properties, member);
		}
		return properties;
	}

	/** Responsibilities: _interface callable properties_. **/
	public interface_properties(node: ts.InterfaceDeclaration): Set<string> {
		const properties = new Set<string>();
		for (const member of node.members) {
			this.append_property(properties, member);
		}
		return properties;
	}

	/** Responsibilities: _class callable properties_. **/
	public class_properties(node: ts.ClassDeclaration): Set<string> {
		const properties = new Set<string>();
		for (const member of node.members) {
			if (!ts.isMethodDeclaration(member)) {
				continue;
			}
			if (member.name === undefined) {
				continue;
			}
			const name = this.property_name(member.name);
			if (name.length > 0) {
				properties.add(name);
			}
		}
		return properties;
	}
}
