import type { CompositeStateTypeRulesContract, NullableTypeRulesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _composite state detection_, _literal union resolution_. **/
export class CompositeStateTypeRules implements CompositeStateTypeRulesContract {
	private readonly _nullable_type_rules: NullableTypeRulesContract;
	private readonly _value_type_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _named type aliases lookup_. **/
	private literal_type_alias(alias_name: string, declaration_source: ts.SourceFile): ts.Node {
		for (const statement of declaration_source.statements) {
			if (!ts.isTypeAliasDeclaration(statement)) {
				continue;
			}
			if (statement.name.text === alias_name) {
				return statement;
			}
		}
		return declaration_source;
	}

	/** Responsibilities: _literal union aliases resolution_. **/
	private referenced_literal_type(
		type_reference: ts.TypeNode,
		reference_source: ts.SourceFile,
		visited_aliases: Set<string>,
	): boolean {
		if (!ts.isTypeReferenceNode(type_reference)) {
			return false;
		}
		if (!ts.isIdentifier(type_reference.typeName)) {
			return false;
		}
		const alias_name = type_reference.typeName.text;
		if (visited_aliases.has(alias_name)) {
			return false;
		}
		return this.literal_alias_union(alias_name, reference_source, visited_aliases);
	}

	/** Responsibilities: _literal aliases classification_. **/
	private literal_alias_union(alias_name: string, alias_source: ts.SourceFile, alias_path: Set<string>): boolean {
		const declaration = this.literal_type_alias(alias_name, alias_source);
		if (!ts.isTypeAliasDeclaration(declaration)) {
			return false;
		}
		if (!ts.isUnionTypeNode(declaration.type)) {
			return false;
		}
		const next_path = new Set(alias_path);
		next_path.add(alias_name);
		return declaration.type.types.every((type) => this.is_literal_type(type, alias_source, next_path));
	}

	/** Responsibilities: _applicable union boundaries classification_. **/
	private is_literal_type(type_node: ts.TypeNode, inspected_source: ts.SourceFile, alias_path: Set<string>): boolean {
		if (ts.isLiteralTypeNode(type_node)) {
			return true;
		}
		return this.referenced_literal_type(type_node, inspected_source, alias_path);
	}

	/** Responsibilities: _classification node inside type_. **/
	private inside_type(containment_candidate: ts.Node, enclosing_type: ts.TypeNode): boolean {
		let current = containment_candidate;
		while (!ts.isSourceFile(current)) {
			if (current === enclosing_type) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _classification function type boundary_. **/
	private function_boundary(type_location: ts.Node, possible_callable: ts.Node): boolean {
		if (!ts.isFunctionLike(possible_callable)) {
			return false;
		}
		if (possible_callable.type === undefined) {
			return false;
		}
		return this.inside_type(type_location, possible_callable.type);
	}

	/** Responsibilities: _classification union boundary parent_. **/
	private boundary_parent(type_location: ts.Node, parent_candidate: ts.Node): boolean {
		if (ts.isTypeAliasDeclaration(parent_candidate)) {
			return true;
		}
		if (ts.isParameter(parent_candidate)) {
			return parent_candidate.dotDotDotToken === undefined;
		}
		if (ts.isPropertyDeclaration(parent_candidate) || ts.isPropertySignature(parent_candidate)) {
			return true;
		}
		return this.function_boundary(type_location, parent_candidate);
	}

	/** Responsibilities: _allowed primitive unions classification_. **/
	private is_boundary(boundary_candidate: ts.Node): boolean {
		let current = boundary_candidate.parent;
		while (!ts.isSourceFile(current)) {
			if (this.boundary_parent(boundary_candidate, current)) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _combine allowed union checks_. **/
	private is_value_union(union_type: ts.UnionTypeNode): boolean {
		const primitive_values = union_type.types.every((type) => this._value_type_kinds.has(type.kind));
		if (primitive_values) {
			return true;
		}
		return union_type.types.every((type) => ts.isArrayTypeNode(type));
	}

	/** Responsibilities: _literal-only unions classification_. **/
	private union_allowed(union_type: ts.UnionTypeNode): boolean {
		if (this.literal(union_type)) {
			return true;
		}
		return this.is_value_union(union_type);
	}

	/** Responsibilities: _literal unions classification_. **/
	/** Responsibilities: _composite type composition_. **/
	public constructor(nullable_type_rules: NullableTypeRulesContract) {
		this._value_type_kinds = new Set([
			ts.SyntaxKind.StringKeyword,
			ts.SyntaxKind.NumberKeyword,
			ts.SyntaxKind.BooleanKeyword,
		]);
		this._nullable_type_rules = nullable_type_rules;
	}

	/** Responsibilities: _composite literal detection_. **/
	public literal(literal_candidate: ts.Node): boolean {
		if (!ts.isUnionTypeNode(literal_candidate)) {
			return false;
		}
		return literal_candidate.types.every((type) =>
			this.is_literal_type(type, literal_candidate.getSourceFile(), new Set()),
		);
	}

	/** Responsibilities: _report state violations_. **/
	public violation(violation_candidate: ts.Node): boolean {
		if (!ts.isUnionTypeNode(violation_candidate) && !ts.isIntersectionTypeNode(violation_candidate)) {
			return false;
		}
		if (this._nullable_type_rules.nullable_type(violation_candidate)) {
			return false;
		}
		if (ts.isUnionTypeNode(violation_candidate) && this.union_allowed(violation_candidate)) {
			return false;
		}
		return this.is_boundary(violation_candidate);
	}
}
