import ts from "typescript";

import { AstPropertySources } from "src/rules/typescript/syntax-rules/ast/ast_property_sources";
import type { AstPropertySourceIndexContract } from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import type { AstPropertySourcesContract, AstPropertyTypeContract, SourceFileResolver } from "src/protocols";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import {
	PROPERTY_STATE_OPTIONAL,
	PROPERTY_STATE_REQUIRED,
	PROPERTY_STATE_UNKNOWN,
} from "src/rules/constants";

/** Responsibilities: _property types_, _type states_. **/
export class AstPropertyType implements AstPropertyTypeContract {
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly unbounded_kinds: Set<ts.SyntaxKind>;
	private readonly source_file: ts.SourceFile;
	private readonly sources: AstPropertySourcesContract;
	private readonly field_states: Map<string, string>;

	/** Responsibilities: _identification undefined type_. **/
	private contains_undefined(type: ts.TypeNode): boolean {
		if (this.unbounded_kinds.has(type.kind)) {
			return true;
		}
		if (ts.isParenthesizedTypeNode(type)) {
			return this.contains_undefined(type.type);
		}
		if (!ts.isUnionTypeNode(type)) {
			return false;
		}
		return type.types.some((item) => this.contains_undefined(item));
	}

	/** Responsibilities: _resolution literal property state_. **/
	private literal_state(type: ts.TypeLiteralNode, property: string): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this.expression_names.static_property_name(member.name) !== property) {
				continue;
			}
			if (member.questionToken !== undefined || member.type === undefined) {
				return PROPERTY_STATE_OPTIONAL;
			}
			if (this.contains_undefined(member.type)) {
				return PROPERTY_STATE_OPTIONAL;
			}
			return PROPERTY_STATE_REQUIRED;
		}
		return PROPERTY_STATE_UNKNOWN;
	}

	/** Responsibilities: _resolution intersection property state_. **/
	private intersection_state(
		type: ts.IntersectionTypeNode,
		source: ts.SourceFile,
		property: string,
		seen: Set<string>,
	): string {
		let found = PROPERTY_STATE_UNKNOWN;
		for (const item of type.types) {
			const state = this.type_state(item, source, property, seen);
			if (state === PROPERTY_STATE_REQUIRED) {
				return state;
			}
			if (state === PROPERTY_STATE_OPTIONAL) {
				found = state;
			}
		}
		return found;
	}

	/** Responsibilities: _resolution referenced property state_. **/
	private reference_state(
		type: ts.TypeReferenceNode,
		source: ts.SourceFile,
		property: string,
		seen: Set<string>,
	): string {
		const key = this.sources.declaration_key(source.fileName, type.typeName.getText(source));
		if (!this.reference_available(key, seen)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		seen.add(key);
		const declaration_node = this.sources.declaration(key);
		if (declaration_node === undefined) {
			return PROPERTY_STATE_UNKNOWN;
		}
		return this.declaration_state(declaration_node, property, seen);
	}

	/** Responsibilities: _identification available type reference_. **/
	private reference_available(key: string, seen: Set<string>): boolean {
		if (key.length === 0) {
			return false;
		}
		if (seen.has(key)) {
			return false;
		}
		return this.sources.declaration_exists(key);
	}

	/** Responsibilities: _resolution declaration property state_. **/
	private declaration_state(declaration_node: ts.Declaration, property: string, seen: Set<string>): string {
		if (ts.isTypeAliasDeclaration(declaration_node)) {
			return this.type_state(declaration_node.type, declaration_node.getSourceFile(), property, seen);
		}
		if (!ts.isInterfaceDeclaration(declaration_node)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		return this.interface_state(declaration_node, property);
	}

	/** Responsibilities: _resolution interface property state_. **/
	private interface_state(type: ts.InterfaceDeclaration, property: string): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this.expression_names.static_property_name(member.name) === property) {
				if (member.questionToken !== undefined || member.type === undefined) {
					return PROPERTY_STATE_OPTIONAL;
				}
				if (this.contains_undefined(member.type)) {
					return PROPERTY_STATE_OPTIONAL;
				}
				return PROPERTY_STATE_REQUIRED;
			}
		}
		return PROPERTY_STATE_UNKNOWN;
	}

	/** Responsibilities: _resolution type property state_. **/
	private type_state(type: ts.TypeNode, source: ts.SourceFile, property: string, seen: Set<string>): string {
		if (ts.isParenthesizedTypeNode(type)) {
			return this.type_state(type.type, source, property, seen);
		}
		if (ts.isTypeLiteralNode(type)) {
			return this.literal_state(type, property);
		}
		if (ts.isIntersectionTypeNode(type)) {
			return this.intersection_state(type, source, property, seen);
		}
		if (!ts.isTypeReferenceNode(type)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		return this.reference_state(type, source, property, seen);
	}

	/** Responsibilities: _resolution caching field state_. **/
	private field_state(base: ts.Identifier, property: string): string {
		const key = `${base.pos}\u0000${property}`;
		const cached = this.field_states.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const type = this.sources.binding_type(base);
		const state = this.type_state(type, this.source_file, property, new Set<string>());
		this.field_states.set(key, state);
		return state;
	}

	/** Responsibilities: _initialization AST property type_. **/
	public constructor(
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolver,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this.expression_names = new TypeScriptExpressionNames();
		this.unbounded_kinds = new Set([
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.UndefinedKeyword,
			ts.SyntaxKind.VoidKeyword,
		]);
		this.field_states = new Map<string, string>();
		this.source_file = source_file;
		this.sources = new AstPropertySources(source_file, source_resolver, module_exports, source_index);
	}

	/** Responsibilities: _fields identification requirement_. **/
	public required_field(base: ts.Identifier, property: string): boolean {
		return this.field_state(base, property) === PROPERTY_STATE_REQUIRED;
	}

	/** Responsibilities: _known fields identification_. **/
	public known_field(base: ts.Identifier, property: string): boolean {
		return this.field_state(base, property) !== PROPERTY_STATE_UNKNOWN;
	}
}
