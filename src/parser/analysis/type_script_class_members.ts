import { PROTECTED_VISIBILITY } from "src/constants";
import type { AstClassField, AstTypeKind, AstVisibility } from "src/model/ast/normalized_ast_types";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import { Syntax } from "src/parser/analysis/syntax";
import { TypeScriptCallbackAliases } from "src/parser/analysis/type_script_callback_aliases";
import type { CallbackCounts, CallbackKind, FieldTypeData } from "src/types";
import type { TypeScriptClassMembersContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _class member extraction_, _interface type member extraction_. **/
export class TypeScriptClassMembers implements TypeScriptClassMembersContract {
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _callback initializer classification_. **/
	private callback_initializer_kind(initializer: ts.Expression): CallbackKind {
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			return "inline";
		}
		if (ts.isIdentifier(initializer)) {
			const aliases = new TypeScriptCallbackAliases(this._source_file, initializer.text, new Set<string>());
			return aliases.kind();
		}
		return "none";
	}

	/** Responsibilities: _class callback member classification_. **/
	private callback_kind(member: ts.ClassElement): CallbackKind {
		if (!ts.isPropertyDeclaration(member)) {
			return "none";
		}
		if (member.initializer !== undefined) {
			return this.callback_initializer_kind(member.initializer);
		}
		if (member.type !== undefined) {
			const type_node = new TypeScriptTypeNode(member.type);
			const details = type_node.details();
			if (details.is_function) {
				return "typed";
			}
		}
		return "none";
	}

	/** Responsibilities: _TypeScript type kind classification_. **/
	private type_kind(node: ts.TypeNode): AstTypeKind {
		const syntax = new Syntax();
		const type_kind = syntax.type_kind(node);
		if (type_kind !== undefined) {
			return type_kind;
		}
		return "basic";
	}

	/** Responsibilities: _property type data_. **/
	private field_type_data(type_node: ts.TypeNode): FieldTypeData {
		return {
			type: type_node.getText(this._source_file),
			type_kind: this.type_kind(type_node),
		};
	}

	/** Responsibilities: _property modifiers_. **/
	private field_modifiers(modifier_owner: ts.Node): readonly ts.Modifier[] {
		if (!ts.canHaveModifiers(modifier_owner)) {
			return [];
		}
		return ts.getModifiers(modifier_owner) ?? [];
	}

	/** Responsibilities: _class property visibility_. **/
	private field_visibility(modifiers: readonly ts.Modifier[]): AstVisibility {
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
			return "private";
		}
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
			return PROTECTED_VISIBILITY;
		}
		return "public";
	}

	/** Responsibilities: _property initializer value name_. **/
	private field_value_name(member: ts.PropertyDeclaration): string {
		if (member.initializer !== undefined && ts.isIdentifier(member.initializer)) {
			return member.initializer.text;
		}
		return "";
	}

	/** Responsibilities: _property field normalization_. **/
	private property_source_details(source_node: ts.Node, property_name: ts.PropertyName): AstClassField {
		if (!ts.isPropertyDeclaration(source_node) && !ts.isPropertySignature(source_node)) {
			throw new Error("Expected a TypeScript property member.");
		}
		let type_data: FieldTypeData;
		if (source_node.type === undefined) {
			type_data = { type: "", type_kind: "basic" };
		} else {
			type_data = this.field_type_data(source_node.type);
		}
		const modifiers = this.field_modifiers(source_node);
		return {
			line: this._source_file.getLineAndCharacterOfPosition(source_node.getStart(this._source_file)).line + 1,
			name: property_name.getText(this._source_file),
			type: type_data.type,
			type_kind: type_data.type_kind,
			readonly: modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword),
			value_name: "",
			class_variable: false,
			class_scope: false,
			visibility: "public",
		};
	}

	/** Responsibilities: _class property field data_. **/
	private class_field_data(member: ts.PropertyDeclaration): AstClassField {
		const property = this.property_source_details(member, member.name);
		const modifiers = this.field_modifiers(member);
		return {
			...property,
			value_name: this.field_value_name(member),
			class_variable: modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword),
			class_scope: false,
			visibility: this.field_visibility(modifiers),
		};
	}

	/** Responsibilities: _normalization class property field_. **/
	private class_field(member: ts.ClassElement): AstClassField[] {
		if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
			return [];
		}
		return [this.class_field_data(member)];
	}

	/** Responsibilities: _normalization interface property field_. **/
	private interface_field(member: ts.TypeElement): AstClassField[] {
		if (!ts.isPropertySignature(member)) {
			return [];
		}
		if (member.name === undefined) {
			return [];
		}
		return [this.property_source_details(member, member.name)];
	}

	/** Responsibilities: _initialization source file usage_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
	}

	/** Responsibilities: _inline callback count_. **/
	public callback_counts(node: ts.ClassLikeDeclaration): CallbackCounts {
		let total = 0;
		let inline = 0;
		for (const member of node.members) {
			const kind = this.callback_kind(member);
			if (kind === "none") {
				continue;
			}
			total += 1;
			if (kind === "inline") {
				inline += 1;
			}
		}
		return { total, inline };
	}

	/** Responsibilities: _collection normalization fields class-like_. **/
	public class_fields(node: ts.ClassLikeDeclaration): AstClassField[] {
		const fields: AstClassField[] = [];
		for (const member of node.members) {
			fields.push(...this.class_field(member));
		}
		return fields;
	}

	/** Responsibilities: _collection normalization fields interface_. **/
	public interface_fields(node: ts.InterfaceDeclaration): AstClassField[] {
		const fields: AstClassField[] = [];
		for (const member of node.members) {
			fields.push(...this.interface_field(member));
		}
		return fields;
	}

	/** Responsibilities: _object type alias fields_. **/
	public type_alias_fields(node: ts.TypeAliasDeclaration): AstClassField[] {
		if (!ts.isTypeLiteralNode(node.type)) {
			return [];
		}
		const fields: AstClassField[] = [];
		for (const member of node.type.members) {
			fields.push(...this.interface_field(member));
		}
		return fields;
	}
}
