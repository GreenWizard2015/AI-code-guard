import ts from "typescript";
import { TestPathSyntax } from "src/test-path-syntax";
import type { Violation } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic-rule";
/** Responsibilities: _detection inline object union_. **/
export class InlineTypes {
	private readonly type_parent_checks: readonly ((node: ts.Node) => boolean)[] = [
		ts.isParameter,
		ts.isPropertySignature,
		ts.isPropertyDeclaration,
		ts.isMethodSignature,
		ts.isFunctionDeclaration,
		ts.isMethodDeclaration,
		ts.isArrowFunction,
		ts.isFunctionExpression,
		ts.isVariableDeclaration,
		ts.isTypeAssertionExpression,
		ts.isAsExpression,
		ts.isSatisfiesExpression,
	];
	private readonly signature_parents: readonly ((node: ts.Node) => boolean)[] = [
		ts.isParameter,
		ts.isPropertySignature,
		ts.isPropertyDeclaration,
		ts.isFunctionDeclaration,
		ts.isMethodDeclaration,
		ts.isMethodSignature,
		ts.isArrowFunction,
		ts.isFunctionExpression,
	];

	/** Responsibilities: _creation violation inline object_. **/
	private object_violation(file: string, line: number, node: ts.Node): Violation[] {
		const rule = new DiagnosticRule("typescript-inline-object-type");
		if (this.is_object_type(node)) {
			return [rule.violation(file, line)];
		}
		if (ts.isClassExpression(node)) {
			return [rule.violation(file, line)];
		}
		if (this.is_inline_function(node)) {
			return [rule.violation(file, line)];
		}
		return [];
	}

	/** Responsibilities: _classification inline function type_. **/
	private is_inline_function(node: ts.Node): boolean {
		if (!ts.isFunctionTypeNode(node)) {
			return false;
		}
		return this.signature_parents.some((check) => check(this.type_parent(node)));
	}

	/** Responsibilities: _creation violation inline union_. **/
	private union_violation(file: string, line: number, node: ts.Node): Violation[] {
		if (!this.is_inline_union(node)) {
			return [];
		}
		const rule = new DiagnosticRule("typescript-inline-union-type");
		return [rule.violation(file, line)];
	}

	/** Responsibilities: _creation violation inline generic_. **/
	private generic_violation(file: string, line: number, node: ts.Node): Violation[] {
		if (!this.generic_type_node(node)) {
			return [];
		}
		const rule = new DiagnosticRule("inline-generic-type");
		return [rule.violation(file, line)];
	}

	/** Responsibilities: _extraction type members inline_. **/
	private type_members(node: ts.Node): readonly ts.TypeElement[] {
		if (ts.isInterfaceDeclaration(node)) {
			return node.members;
		}
		if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
			return node.type.members;
		}
		return [];
	}

	/** Responsibilities: _creation violation inline object_. **/
	private type_field_violation(file: string, line: number, node: ts.Node): Violation[] {
		const count = this.type_members(node).filter(ts.isPropertySignature).length;
		if (count <= 10) {
			return [];
		}
		const rule = new DiagnosticRule("type-field-count");
		return [rule.violation(file, line, { count: String(count) })];
	}

	/** Responsibilities: _classification node contains inline_. **/
	private unwrapped_type(node: ts.TypeNode): ts.TypeNode {
		if (ts.isParenthesizedTypeNode(node)) {
			return this.unwrapped_type(node.type);
		}
		return node;
	}

	/** Responsibilities: _classification generic inline_. **/
	private generic_type_node(node: ts.Node): boolean {
		if (!ts.isTypeLiteralNode(node)) {
			return false;
		}
		let parent = node.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		if (!ts.isTypeReferenceNode(parent)) {
			return false;
		}
		if (!parent.typeArguments) {
			return false;
		}
		return parent.typeArguments.some((argument) => this.unwrapped_type(argument) === node);
	}

	/** Responsibilities: _classification union node inline_. **/
	private is_inline_union(node: ts.Node): boolean {
		if (!ts.isUnionTypeNode(node)) {
			return false;
		}
		if (!this.signature_parents.some((check) => check(this.type_parent(node)))) {
			return false;
		}
		return node.types.every(ts.isLiteralTypeNode);
	}

	/** Responsibilities: _classification type literal inline_. **/
	private type_parent(node: ts.Node): ts.Node {
		let parent = node.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _classification type literal inline_. **/
	private is_object_type(node: ts.Node): boolean {
		if (!ts.isTypeLiteralNode(node)) {
			return false;
		}
		const has_type_parent = this.type_parent_checks.some((check) => check(this.type_parent(node)));
		if (!has_type_parent) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _collection inline-type violations AST_. **/
	public node_violations(file: string, source_file: ts.SourceFile, node: ts.Node): Violation[] {
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		return [
			...this.object_violation(file, line, node),
			...this.union_violation(file, line, node),
			...this.generic_violation(file, line, node),
			...this.type_field_violation(file, line, node),
		];
	}

	/** Responsibilities: _aggregation inline-type violations traversing_. **/
	public append_inline_types(violations: Violation[], file: string, source_file: ts.SourceFile): void {
		const test_path_syntax = new TestPathSyntax();

		if (test_path_syntax.test_ts(file)) {
			return;
		}
		const visit = (node: ts.Node): void => {
			violations.push(...this.node_violations(file, source_file, node));
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}
}
