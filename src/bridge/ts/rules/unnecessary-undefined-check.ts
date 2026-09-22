import ts from 'typescript';

import { AstPropertyType } from 'src/bridge/ts/rules/ast-property-type-resolver';
import type { RuleAppender } from 'src/types';

/** Responsibilities: _detection unnecessary undefined checks_. **/
export class UnnecessaryUndefinedCheck {
	private readonly comparison_operators = new Set([
		ts.SyntaxKind.EqualsEqualsEqualsToken,
		ts.SyntaxKind.ExclamationEqualsEqualsToken,
		ts.SyntaxKind.EqualsEqualsToken,
		ts.SyntaxKind.ExclamationEqualsToken,
	]);
	private readonly resolver: AstPropertyType;
	private readonly append_rule: RuleAppender;

	/** Responsibilities: _classification binary expressions compare_. **/
	private is_undefined_comparison(node: ts.BinaryExpression): boolean {
		const operator = node.operatorToken.kind;
		if (this.comparison_operators.has(operator)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _expression resolution validation_. **/
	private checked_expression(node: ts.BinaryExpression): ts.Expression {
		if (ts.isIdentifier(node.left)) {
			if (node.left.text === 'undefined') {
				return node.right;
			}
		}
		if (ts.isIdentifier(node.right)) {
			if (node.right.text === 'undefined') {
				return node.left;
			}
		}
		return node;
	}

	/** Responsibilities: _classification undefined comparison targets_. **/
	private is_unnecessary_comparison(node: ts.BinaryExpression): boolean {
		if (!this.is_undefined_comparison(node)) {
			return false;
		}
		const expression = this.checked_expression(node);
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		const known = this.resolver.known_field(expression.expression.text, expression.name.text);
		return known && this.resolver.required_field(expression.expression.text, expression.name.text);
	}

	/** Responsibilities: _classification property access known_. **/
	private is_unnecessary_access(node: ts.PropertyAccessExpression): boolean {
		if (node.questionDotToken === undefined) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		const known = this.resolver.known_field(node.expression.text, node.name.text);
		return known && this.resolver.required_field(node.expression.text, node.name.text);
	}

	/** Responsibilities: _initialization source property state_. **/
	public constructor(source_file: ts.SourceFile, append_rule: RuleAppender) {
		this.resolver = new AstPropertyType(source_file);
		this.append_rule = append_rule;
	}

	/** Responsibilities: _reporting node contains unnecessary_. **/
	public matches(node: ts.Node): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.is_unnecessary_comparison(node);
		}
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.is_unnecessary_access(node);
	}

	/** Responsibilities: _aggregation diagnostic node violates_. **/
	public append(node: ts.Node): void {
		if (this.matches(node)) {
			this.append_rule(node, 'unnecessary-undefined-check');
		}
	}
}
