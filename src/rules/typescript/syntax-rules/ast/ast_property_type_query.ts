import ts from "typescript";

import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { PROPERTY_STATE_OPTIONAL, PROPERTY_STATE_REQUIRED, PROPERTY_STATE_UNKNOWN } from "src/rules/constants";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { AstPropertySourcesContract } from "src/source_protocols";

/** Responsibilities: _property state_, _type reference state_. **/
export class AstPropertyTypeQuery {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _unbounded_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _sources: AstPropertySourcesContract;
	private readonly _property: string;
	private readonly _seen: Set<string>;

	/** Responsibilities: _identification undefined type_. **/
	private contains_undefined(member_type: ts.TypeNode): boolean {
		if (this._unbounded_kinds.has(member_type.kind)) {
			return true;
		}
		if (ts.isParenthesizedTypeNode(member_type)) {
			return this.contains_undefined(member_type.type);
		}
		if (!ts.isUnionTypeNode(member_type)) {
			return false;
		}
		return member_type.types.some((item) => this.contains_undefined(item));
	}

	/** Responsibilities: _resolution literal property state_. **/
	private literal_state(type: ts.TypeLiteralNode): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this._expression_names.static_property_name(member.name) === this._property) {
				return this.state_for_member(member);
			}
		}
		return PROPERTY_STATE_UNKNOWN;
	}

	/** Responsibilities: _resolution intersection property state_. **/
	private intersection_state(type: ts.IntersectionTypeNode): string {
		let found = PROPERTY_STATE_UNKNOWN;
		for (const item of type.types) {
			const state = this.type_state(item);
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
	private reference_state(type: ts.TypeReferenceNode): string {
		const key = this._sources.declaration_key(type.getSourceFile().fileName, type.typeName.getText());
		if (key.length === 0) {
			return PROPERTY_STATE_UNKNOWN;
		}
		if (this._seen.has(key)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		if (!this._sources.declaration_exists(key)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		this._seen.add(key);
		return this.declaration_state(this._sources.declaration(key));
	}

	/** Responsibilities: _resolution declaration property state_. **/
	private declaration_state(declaration_node: ts.Declaration): string {
		if (ts.isTypeAliasDeclaration(declaration_node)) {
			return this.type_state(declaration_node.type);
		}
		if (!ts.isInterfaceDeclaration(declaration_node)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		return this.interface_state(declaration_node);
	}

	/** Responsibilities: _resolution interface property state_. **/
	private interface_state(type: ts.InterfaceDeclaration): string {
		for (const member of type.members) {
			if (!ts.isPropertySignature(member)) {
				continue;
			}
			if (this._expression_names.static_property_name(member.name) === this._property) {
				return this.state_for_member(member);
			}
		}
		return PROPERTY_STATE_UNKNOWN;
	}

	/** Responsibilities: _resolution type property state_. **/
	private type_state(declared_type: ts.TypeNode): string {
		if (ts.isParenthesizedTypeNode(declared_type)) {
			return this.type_state(declared_type.type);
		}
		if (ts.isTypeLiteralNode(declared_type)) {
			return this.literal_state(declared_type);
		}
		if (ts.isIntersectionTypeNode(declared_type)) {
			return this.intersection_state(declared_type);
		}
		if (!ts.isTypeReferenceNode(declared_type)) {
			return PROPERTY_STATE_UNKNOWN;
		}
		return this.reference_state(declared_type);
	}

	/** Responsibilities: _resolver dependencies_, _field state cache context_. **/
	public constructor(sources: AstPropertySourcesContract, property: string) {
		this._expression_names = new TypeScriptExpressionNames();
		this._unbounded_kinds = new Set([
			ts.SyntaxKind.AnyKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.UndefinedKeyword,
			ts.SyntaxKind.VoidKeyword,
		]);
		this._sources = sources;
		this._property = property;
		this._seen = new Set<string>();
	}

	/** Responsibilities: _property member state_. **/
	public state_for_member(member: ts.PropertySignature): string {
		if (member.questionToken !== undefined || member.type === undefined) {
			return PROPERTY_STATE_OPTIONAL;
		}
		if (this.contains_undefined(member.type)) {
			return PROPERTY_STATE_OPTIONAL;
		}
		return PROPERTY_STATE_REQUIRED;
	}

	/** Responsibilities: _binding property state resolution_. **/
	public state(base: ts.Identifier): string {
		return this.type_state(this._sources.binding_type(base));
	}
}
