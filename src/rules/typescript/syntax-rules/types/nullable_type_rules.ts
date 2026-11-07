import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";
import type { NullableTypeRulesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _nullable type boundary classification_, _explicit nullish annotation checks_. **/
export class NullableTypeRules implements NullableTypeRulesContract {
	private readonly _nullish_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _classification node optional type_. **/
	private is_optional_boundary(declaration_candidate: ts.Node): boolean {
		if (ts.isPropertyDeclaration(declaration_candidate)) {
			// Continue with the shared optional-boundary checks.
		} else if (ts.isPropertySignature(declaration_candidate)) {
			// Continue with the shared optional-boundary checks.
		} else if (!ts.isParameter(declaration_candidate)) {
			return false;
		}
		if (declaration_candidate.questionToken === undefined || declaration_candidate.type === undefined) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _classification node nullish type_. **/
	private is_nullish_boundary(property_declaration: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(property_declaration) && !ts.isPropertySignature(property_declaration)) {
			return false;
		}
		if (property_declaration.type === undefined) {
			return false;
		}
		return this.nullish_type(property_declaration.type);
	}

	/** Responsibilities: _classification union contains nullish_. **/
	private nullable_parent(union_candidate: ts.Node): ts.Node {
		let parent = union_candidate.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _classification union contains nullish_. **/
	private is_nullable_union(union_candidate: ts.Node): boolean {
		if (!ts.isUnionTypeNode(union_candidate)) {
			return false;
		}
		const parent = this.nullable_parent(union_candidate);
		if (!this.is_nullable_parent(parent)) {
			return false;
		}
		if (!union_candidate.types.some((type) => this.nullish_type(type))) {
			return false;
		}
		return union_candidate.types.some((type) => !this.nullish_type(type));
	}

	/** Responsibilities: _classification parent node allows_. **/
	private is_nullable_parent(parent_candidate: ts.Node): boolean {
		if (ts.isParameter(parent_candidate) || ts.isPropertyDeclaration(parent_candidate)) {
			return true;
		}
		if (ts.isPropertySignature(parent_candidate) || ts.isFunctionLike(parent_candidate)) {
			return true;
		}
		return ts.isMethodSignature(parent_candidate);
	}

	/** Responsibilities: _nullable type policy ownership_. **/
	public constructor(nullish_kinds: ReadonlySet<ts.SyntaxKind>) {
		this._nullish_kinds = nullish_kinds;
	}
	/** Responsibilities: _public operation_. **/
	public nullish_type(type_candidate: ts.TypeNode): boolean {
		if (this._nullish_kinds.has(type_candidate.kind)) {
			return true;
		}
		if (ts.isLiteralTypeNode(type_candidate)) {
			return type_candidate.literal.kind === ts.SyntaxKind.NullKeyword;
		}
		if (!ts.isTypeReferenceNode(type_candidate)) {
			return false;
		}
		if (!ts.isIdentifier(type_candidate.typeName)) {
			return false;
		}
		return type_candidate.typeName.text === UNDEFINED_TYPE_NAME;
	}

	/** Responsibilities: _reporting node permitted nullable_. **/
	public nullable_type(type_boundary: ts.Node): boolean {
		if (this.is_optional_boundary(type_boundary)) {
			return true;
		}
		if (this.is_nullish_boundary(type_boundary)) {
			return true;
		}
		return this.is_nullable_union(type_boundary);
	}
}
