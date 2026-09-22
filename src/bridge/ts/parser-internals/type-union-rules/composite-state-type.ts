import ts from 'typescript';
import { NullableTypeRules } from 'src/bridge/ts/parser-internals/type-union-rules/nullable-type-rules';

/** Responsibilities: _composite state types classification_. **/
export class CompositeStateTypeRules {
	private readonly nullable_type_rules = new NullableTypeRules();
	private readonly value_type_kinds = new Set([
		ts.SyntaxKind.StringKeyword,
		ts.SyntaxKind.NumberKeyword,
		ts.SyntaxKind.BooleanKeyword,
	]);
	/** Responsibilities: _named type aliases lookup_. **/
	private literal_type_alias(name: string, source_file: ts.SourceFile): ts.Node {
		for (const statement of source_file.statements) {
			if (!ts.isTypeAliasDeclaration(statement)) {
				continue;
			}
			if (statement.name.text === name) {
				return statement;
			}
		}
		return source_file;
	}

	/** Responsibilities: _object compositions resolution_. **/
	private is_object_alias(node: ts.TypeNode, source_file: ts.SourceFile, seen: Set<string>): boolean {
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.typeName)) {
			return false;
		}
		const name = node.typeName.text;
		if (seen.has(name)) {
			return false;
		}
		return this.object_alias_definition(name, source_file, seen);
	}

	/** Responsibilities: _recursive object aliases inspection_. **/
	private object_alias_definition(name: string, source_file: ts.SourceFile, seen: Set<string>): boolean {
		const declaration = this.literal_type_alias(name, source_file);
		if (!ts.isTypeAliasDeclaration(declaration)) {
			return false;
		}
		const next_seen = new Set(seen);
		next_seen.add(name);
		if (ts.isTypeLiteralNode(declaration.type)) {
			return true;
		}
		if (!ts.isIntersectionTypeNode(declaration.type)) {
			return false;
		}
		return declaration.type.types.every(type => this.is_object_alias(type, source_file, next_seen));
	}

	/** Responsibilities: _structural intersections classification_. **/
	private is_structural_composition(node: ts.IntersectionTypeNode): boolean {
		if (!ts.isTypeAliasDeclaration(node.parent)) {
			return false;
		}
		const source_file = node.getSourceFile();
		const seen = new Set<string>();
		return node.types.every(type => this.is_object_alias(type, source_file, seen));
	}

	/** Responsibilities: _literal union aliases resolution_. **/
	private referenced_literal_type(node: ts.TypeNode, source_file: ts.SourceFile, seen: Set<string>): boolean {
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.typeName)) {
			return false;
		}
		const name = node.typeName.text;
		if (seen.has(name)) {
			return false;
		}
		return this.literal_alias_union(name, source_file, seen);
	}

	/** Responsibilities: _literal aliases classification_. **/
	private literal_alias_union(name: string, source_file: ts.SourceFile, seen: Set<string>): boolean {
		const declaration = this.literal_type_alias(name, source_file);
		if (!ts.isTypeAliasDeclaration(declaration)) {
			return false;
		}
		if (!ts.isUnionTypeNode(declaration.type)) {
			return false;
		}
		const next_seen = new Set(seen);
		next_seen.add(name);
		return declaration.type.types.every(type => this.is_literal_type(type, source_file, next_seen));
	}

	/** Responsibilities: _applicable union boundaries classification_. **/
	private is_literal_type(node: ts.TypeNode, source_file: ts.SourceFile, seen: Set<string>): boolean {
		if (ts.isLiteralTypeNode(node)) {
			return true;
		}
		return this.referenced_literal_type(node, source_file, seen);
	}

	/** Responsibilities: _allowed primitive unions classification_. **/
	private is_boundary(node: ts.Node): boolean {
		const parent = node.parent;
		if (ts.isTypeAliasDeclaration(parent)) {
			return true;
		}
		if (ts.isParameter(parent)) {
			return parent.dotDotDotToken === undefined;
		}
		if (ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) {
			return true;
		}
		return ts.isFunctionLike(parent) && parent.type === node;
	}

	/** Responsibilities: _combine allowed union checks_. **/
	private is_value_union(node: ts.UnionTypeNode): boolean {
		const primitive_values = node.types.every(type => this.value_type_kinds.has(type.kind));
		if (primitive_values) {
			return true;
		}
		return node.types.every(type => ts.isArrayTypeNode(type));
	}

	/** Responsibilities: _literal-only unions classification_. **/
	private union_allowed(node: ts.UnionTypeNode): boolean {
		if (this.literal(node)) {
			return true;
		}
		return this.is_value_union(node);
	}

	/** Responsibilities: _literal unions classification_. **/
	public literal(node: ts.Node): boolean {
		if (!ts.isUnionTypeNode(node)) {
			return false;
		}
		return node.types.every(type => this.is_literal_type(type, node.getSourceFile(), new Set()));
	}

	/** Responsibilities: _report state violations_. **/
	public violation(node: ts.Node): boolean {
		if (!ts.isUnionTypeNode(node) && !ts.isIntersectionTypeNode(node)) {
			return false;
		}
		if (this.nullable_type_rules.nullable_type(node)) {
			return false;
		}
		if (ts.isUnionTypeNode(node) && this.union_allowed(node)) {
			return false;
		}
		if (ts.isIntersectionTypeNode(node) && this.is_structural_composition(node)) {
			return false;
		}
		return this.is_boundary(node);
	}
}
