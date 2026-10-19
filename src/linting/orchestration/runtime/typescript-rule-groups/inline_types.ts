import ts from "typescript";
import type { ViolationContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { InlineViolationFlags } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
/** Responsibilities: _inline type classification_, _nested object diagnostics_. **/
export class InlineTypes {
	private readonly object_rule: DiagnosticRule;
	private readonly union_rule: DiagnosticRule;
	private readonly generic_rule: DiagnosticRule;
	private readonly field_count_rule: DiagnosticRule;
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

	/** Responsibilities: _classification inline object_. **/
	private object_violation(node: ts.Node): boolean {
		if (this.is_object_type(node)) {
			return true;
		}
		if (ts.isClassExpression(node)) {
			return true;
		}
		return this.is_inline_function(node);
	}

	/** Responsibilities: _classification inline function type_. **/
	private is_inline_function(node: ts.Node): boolean {
		if (!ts.isFunctionTypeNode(node)) {
			return false;
		}
		return this.signature_parents.some((check) => check(this.type_parent(node)));
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

	/** Responsibilities: _inline violation classification_. **/
	private violation_flags(node: ts.Node): InlineViolationFlags {
		const field_count = this.type_members(node).filter(ts.isPropertySignature).length;
		return {
			object: this.object_violation(node),
			union: this.is_inline_union(node),
			generic: this.generic_type_node(node),
			field_count,
		};
	}

	/** Responsibilities: _inline violation creation_. **/
	private append_flagged_violations(
		violations: ViolationContract[],
		file: string,
		line: number,
		flags: InlineViolationFlags,
	): void {
		if (flags.object) {
			violations.push(this.object_rule.violation(file, line));
		}
		if (flags.union) {
			violations.push(this.union_rule.violation(file, line));
		}
		if (flags.generic) {
			violations.push(this.generic_rule.violation(file, line));
		}
		if (flags.field_count > 10) {
			violations.push(this.field_count_rule.violation(file, line, { count: String(flags.field_count) }));
		}
	}

	/** Responsibilities: _inline violation presence_. **/
	private has_violation(flags: InlineViolationFlags): boolean {
		if (flags.object || flags.union) {
			return true;
		}
		if (flags.generic) {
			return true;
		}
		return flags.field_count > 10;
	}

	/** Responsibilities: _collection inline-type violations AST_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.object_rule = new DiagnosticRule("typescript-inline-object-type");
		this.union_rule = new DiagnosticRule("typescript-inline-union-type");
		this.generic_rule = new DiagnosticRule("inline-generic-type");
		this.field_count_rule = new DiagnosticRule("type-field-count");
	}
	/** Responsibilities: _public operation_. **/
	public node_violations(file: string, source_file: ts.SourceFile, node: ts.Node): ViolationContract[] {
		const flags = this.violation_flags(node);
		if (!this.has_violation(flags)) {
			return [];
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		const violations: ViolationContract[] = [];
		this.append_flagged_violations(violations, file, line, flags);
		return violations;
	}

	/** Responsibilities: _inline node violations_. **/
	public append_node(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.Node,
	): void {
		violations.push(...this.node_violations(file, source_file, node));
	}

}
