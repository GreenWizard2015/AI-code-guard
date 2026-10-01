import { Syntax } from "src/syntax";
import ts from "typescript";

import type { AstClassField, AstTypeKind } from "src/types";
import { TypeScriptTypeNode } from "src/model/typescript-type-node";
import { TypeScriptCallbackAliases } from "src/parser/ts/typescript-callback-aliases";

import type { CallbackCounts, CallbackKind, FieldTypeData } from "src/types";

/** Responsibilities: _classification TypeScript class interface_. **/
export class TypeScriptClassMembers {
	private readonly source_file: ts.SourceFile;
	private readonly callback_aliases: TypeScriptCallbackAliases;

	/** Responsibilities: _callback initializer classification_. **/
	private callback_initializer_kind(initializer: ts.Expression): CallbackKind {
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			return "inline";
		}
		if (ts.isIdentifier(initializer)) {
			return this.callback_aliases.kind(initializer.text);
		}
		return "none";
	}

	/** Responsibilities: _classification callback shape class_. **/
	private callback_kind(member: ts.ClassElement): CallbackKind {
		if (!ts.isPropertyDeclaration(member)) {
			return "none";
		}
		if (member.initializer !== undefined) {
			return this.callback_initializer_kind(member.initializer);
		}
		if (member.type !== undefined) {
			const type_node = new TypeScriptTypeNode(member.type);
			if (type_node.details().is_function) {
				return "typed";
			}
		}
		return "none";
	}

	/** Responsibilities: _resolution identifier initializer name_. **/
	private identifier_initializer_name(member: ts.PropertyDeclaration): string {
		if (member.initializer !== undefined) {
			if (ts.isIdentifier(member.initializer)) {
				return member.initializer.text;
			}
		}
		return "";
	}

	/** Responsibilities: _resolution field type type-kind_. **/
	private field_type_data(member: ts.PropertyDeclaration): FieldTypeData {
		if (member.type === undefined) {
			return { type: "", type_kind: "basic" };
		}
		return {
			type: member.type.getText(this.source_file),
			type_kind: this.type_kind(member.type),
		};
	}

	/** Responsibilities: _classification TypeScript type node_. **/
	private type_kind(node: ts.TypeNode): AstTypeKind {
		const syntax = new Syntax();
		const type_kind = syntax.type_kind(node);
		if (type_kind !== undefined) {
			return type_kind;
		}
		return "basic";
	}

	/** Responsibilities: _normalization class property field_. **/
	private class_field(member: ts.ClassElement): AstClassField[] {
		if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
			return [];
		}
		const type_data = this.field_type_data(member);
		return [
			{
				line: this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line + 1,
				name: member.name.getText(this.source_file),
				value_name: this.identifier_initializer_name(member),
				type: type_data.type,
				type_kind: type_data.type_kind,
				class_variable: false,
			},
		];
	}

	/** Responsibilities: _interface field type data_. **/
	private interface_field_data(member: ts.PropertySignature): FieldTypeData {
		if (member.type === undefined) {
			return { type: "", type_kind: "basic" };
		}
		return {
			type: member.type.getText(this.source_file),
			type_kind: this.type_kind(member.type),
		};
	}

	/** Responsibilities: _normalization interface property field_. **/
	private interface_field(member: ts.TypeElement): AstClassField[] {
		if (!ts.isPropertySignature(member)) {
			return [];
		}
		if (member.name === undefined) {
			return [];
		}
		const type_data = this.interface_field_data(member);
		return [
			{
				line: this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line + 1,
				name: member.name.getText(this.source_file),
				value_name: "",
				type: type_data.type,
				type_kind: type_data.type_kind,
				class_variable: false,
			},
		];
	}

	/** Responsibilities: _initialization source file usage_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.callback_aliases = new TypeScriptCallbackAliases(source_file);
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
}
