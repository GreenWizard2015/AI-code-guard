import ts from "typescript";
import type { NullableTypeRulesContract } from "src/runtime_protocols";
import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";

/** Responsibilities: _nullable type boundary classification_, _explicit nullish annotation checks_. **/
export class NullableTypeRules implements NullableTypeRulesContract {
	private readonly nullish_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _classification node optional type_. **/
	private is_optional_boundary(node: ts.Node): boolean {
		if (ts.isPropertyDeclaration(node)) {
			// Continue with the shared optional-boundary checks.
		} else if (ts.isPropertySignature(node)) {
			// Continue with the shared optional-boundary checks.
		} else if (!ts.isParameter(node)) {
			return false;
		}
		if (node.questionToken === undefined || node.type === undefined) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _classification node nullish type_. **/
	private is_nullish_boundary(node: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(node) && !ts.isPropertySignature(node)) {
			return false;
		}
		if (node.type === undefined) {
			return false;
		}
		return this.nullish_type(node.type);
	}

	/** Responsibilities: _classification union contains nullish_. **/
	private nullable_parent(node: ts.Node): ts.Node {
		let parent = node.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _classification union contains nullish_. **/
	private is_nullable_union(node: ts.Node): boolean {
		if (!ts.isUnionTypeNode(node)) {
			return false;
		}
		const parent = this.nullable_parent(node);
		if (!this.is_nullable_parent(parent)) {
			return false;
		}
		if (!node.types.some((type) => this.nullish_type(type))) {
			return false;
		}
		return node.types.some((type) => !this.nullish_type(type));
	}

	/** Responsibilities: _classification parent node allows_. **/
	private is_nullable_parent(parent: ts.Node): boolean {
		if (ts.isParameter(parent) || ts.isPropertyDeclaration(parent)) {
			return true;
		}
		if (ts.isPropertySignature(parent) || ts.isFunctionLike(parent)) {
			return true;
		}
		return ts.isMethodSignature(parent);
	}

	/** Responsibilities: _reporting type node explicitly_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.nullish_kinds = new Set([
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.UndefinedKeyword,
			ts.SyntaxKind.VoidKeyword,
			ts.SyntaxKind.NeverKeyword,
			ts.SyntaxKind.UnknownKeyword,
			ts.SyntaxKind.AnyKeyword,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public nullish_type(node: ts.TypeNode): boolean {
		if (this.nullish_kinds.has(node.kind)) {
			return true;
		}
		if (ts.isLiteralTypeNode(node)) {
			return node.literal.kind === ts.SyntaxKind.NullKeyword;
		}
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.typeName)) {
			return false;
		}
		return node.typeName.text === UNDEFINED_TYPE_NAME;
	}

	/** Responsibilities: _reporting node permitted nullable_. **/
	public nullable_type(node: ts.Node): boolean {
		if (this.is_optional_boundary(node)) {
			return true;
		}
		if (this.is_nullish_boundary(node)) {
			return true;
		}
		return this.is_nullable_union(node);
	}
}
