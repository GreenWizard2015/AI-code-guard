import ts from 'typescript';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';
import { TypeScriptStaticKeyAliases } from 'src/typescript-callable-aliases/static-key-aliases';

/** Responsibilities: _callable type property collection_. **/
export class TypeScriptCallableTypeProperties {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly callable_member_kinds = new Set([ts.SyntaxKind.MethodSignature]);
	private readonly static_key_aliases = new TypeScriptStaticKeyAliases();

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
		if (member.type !== undefined && ts.isFunctionTypeNode(member.type)) {
			properties.add(name);
		}
	}

	/** Responsibilities: _typed property name resolution_. **/
	public property_name(name: ts.PropertyName): string {
		const literal_name = this.expression_names.static_property_name(name);
		if (literal_name !== '') {
			return literal_name;
		}
		if (ts.isComputedPropertyName(name)) {
			return this.static_key_aliases.value(name.expression, name);
		}
		return '';
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
			if (!ts.isMethodDeclaration(member) || member.name === undefined) {
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
