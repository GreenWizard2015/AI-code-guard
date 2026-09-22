import { Syntax } from 'src/syntax';
import ts from 'typescript';

import type { AstClassField, AstTypeKind } from 'src/types';
import { TypeScriptTypeNode } from 'src/model/typescript-type-node';


import type { CallbackCounts, CallbackKind, FieldTypeData } from 'src/types';

/** Responsibilities: _classification TypeScript class interface_. **/
export class TypeScriptClassMembers {
	private readonly source_file: ts.SourceFile;
	/** Responsibilities: _classification callback shape class_. **/
	private callback_kind(member: ts.ClassElement): CallbackKind {
		if (!ts.isPropertyDeclaration(member)) {
			return 'none';
		}
		if (member.initializer !== undefined) {
if (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer)) {
				return 'inline';
			}
		}
		if (member.type !== undefined) {
			const type_node = new TypeScriptTypeNode(member.type);
			if (type_node.details().is_function) {
				return 'typed';
			}
		}
		return 'none';
	}

	/** Responsibilities: _resolution identifier initializer name_. **/
	private identifier_initializer_name(member: ts.PropertyDeclaration): string {
if (member.initializer !== undefined && ts.isIdentifier(member.initializer)) {
			return member.initializer.text;
		}
		return '';
	}

	/** Responsibilities: _resolution field type type-kind_. **/
	private field_type_data(member: ts.PropertyDeclaration): FieldTypeData {
		if (member.type === undefined) {
			return { type: '', type_kind: 'basic' };
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
		return 'basic';
	}

	/** Responsibilities: _normalization class property field_. **/
	private class_field(member: ts.ClassElement): AstClassField[] {
if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) {
			return [];
		}
		const type_data = this.field_type_data(member);
		return [{
			line:
				this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line + 1,
			name: member.name.getText(this.source_file),
			value_name: this.identifier_initializer_name(member),
			type: type_data.type,
			type_kind: type_data.type_kind,
		}];
	}

	/** Responsibilities: _normalization interface property field_. **/
	private interface_field(member: ts.TypeElement): AstClassField[] {
if (!ts.isPropertySignature(member) || member.name === undefined) {
			return [];
		}
		let type_kind_value: AstTypeKind = 'basic';
		if (member.type !== undefined) {
			type_kind_value = this.type_kind(member.type);
		}
		let type = '';
		if (member.type !== undefined) {
			type = member.type.getText(this.source_file);
		}
		return [{
			line:
				this.source_file.getLineAndCharacterOfPosition(member.getStart(this.source_file)).line + 1,
			name: member.name.getText(this.source_file),
			value_name: '',
			type,
			type_kind: type_kind_value,
		}];
	}

	/** Responsibilities: _initialization source file usage_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _inline callback count_. **/
	public callback_counts(node: ts.ClassLikeDeclaration): CallbackCounts {
		let total = 0;
		let inline = 0;
		for (const member of node.members) {
			const kind = this.callback_kind(member);
			if (kind === 'none') {
				continue;
			}
			total += 1;
			if (kind === 'inline') {
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
