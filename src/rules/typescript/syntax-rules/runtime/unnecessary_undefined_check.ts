import ts from "typescript";

import { AstPropertyType } from "src/rules/typescript/syntax-rules/ast/ast_property_type";
import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";
import { RULE_IDS } from "src/constants";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { RuleAppender } from "src/types";
import type { AstPropertyTypeContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { UnnecessaryUndefinedCheckContract } from "src/analysis_protocols";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";

/** Responsibilities: _undefined checks_, _field types_. **/
export class UnnecessaryUndefinedCheck implements UnnecessaryUndefinedCheckContract {
	private readonly comparison_operators: Set<ts.SyntaxKind>;
	private readonly resolver: AstPropertyTypeContract;
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
			if (node.left.text === UNDEFINED_TYPE_NAME) {
				return node.right;
			}
		}
		if (ts.isIdentifier(node.right)) {
			if (node.right.text === UNDEFINED_TYPE_NAME) {
				return node.left;
			}
		}
		return node;
	}

	/** Responsibilities: _static element field names_. **/
	private element_name(node: ts.ElementAccessExpression): string {
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this.unwrapped_key(argument);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return "";
	}

	/** Responsibilities: _unwrapping static element key_. **/
	private unwrapped_key(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
		}
	}

	/** Responsibilities: _known field lookup_. **/
	private required_field(expression: ts.Expression, name: string): boolean {
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		if (name === "") {
			return false;
		}
		if (!this.resolver.known_field(expression, name)) {
			return false;
		}
		return this.resolver.required_field(expression, name);
	}

	/** Responsibilities: _known field expressions_. **/
	private required_field_expression(expression: ts.Expression): boolean {
		expression = this.unwrapped_key(expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return this.required_field(expression.expression, expression.name.text);
		}
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		return this.required_field(expression.expression, this.element_name(expression));
	}

	/** Responsibilities: _classification undefined comparison targets_. **/
	private is_unnecessary_comparison(node: ts.BinaryExpression): boolean {
		if (!this.is_undefined_comparison(node)) {
			return false;
		}
		const expression = this.checked_expression(node);
		return this.required_field_expression(expression);
	}

	/** Responsibilities: _classification property access known_. **/
	private is_unnecessary_access(node: ts.PropertyAccessExpression): boolean {
		if (node.questionDotToken === undefined) {
			return false;
		}
		const expression = this.unwrapped_key(node.expression);
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		const known = this.resolver.known_field(expression, node.name.text);
		if (!known) {
			return false;
		}
		return this.resolver.required_field(expression, node.name.text);
	}

	/** Responsibilities: _optional element access classification_. **/
	private unnecessary_element(node: ts.ElementAccessExpression): boolean {
		if (node.questionDotToken === undefined) {
			return false;
		}
		return this.required_field(node.expression, this.element_name(node));
	}

	/** Responsibilities: _initialization source property state_. **/
	public constructor(
		source_file: ts.SourceFile,
		append_rule: RuleAppender,
		source_resolver: SourceFileResolver,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this.comparison_operators = new Set([
			ts.SyntaxKind.EqualsEqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsToken,
		]);
		this.resolver = new AstPropertyType(source_file, source_resolver, module_exports, source_index);
		this.append_rule = append_rule;
	}

	/** Responsibilities: _reporting node contains unnecessary_. **/
	public matches(node: ts.Node): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.is_unnecessary_comparison(node);
		}
		if (!ts.isPropertyAccessExpression(node)) {
			if (!ts.isElementAccessExpression(node)) {
				return false;
			}
			return this.unnecessary_element(node);
		}
		return this.is_unnecessary_access(node);
	}

	/** Responsibilities: _aggregation diagnostic node violates_. **/
	public append(node: ts.Node): void {
		if (this.matches(node)) {
			this.append_rule(node, RULE_IDS.unnecessary_undefined_check);
		}
	}
}
