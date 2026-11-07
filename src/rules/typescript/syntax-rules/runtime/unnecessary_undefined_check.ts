import type { UnnecessaryUndefinedCheckContract } from "src/analysis_protocols";
import { RULE_IDS } from "src/linting/constants";
import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { PROPERTY_STATE_REQUIRED } from "src/rules/constants";
import { AstPropertyType } from "src/rules/typescript/syntax-rules/ast/ast_property_type";
import type { AstPropertySourceIndexContract } from "src/source_protocols";
import type { AstPropertyTypeContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { CallableRuleAppender } from "src/types";
import ts from "typescript";

/** Responsibilities: _undefined checks_, _field types_. **/
export class UnnecessaryUndefinedCheck implements UnnecessaryUndefinedCheckContract {
	private readonly _comparison_operators: Set<ts.SyntaxKind>;
	private readonly _resolver: AstPropertyTypeContract;
	private readonly _append_rule: CallableRuleAppender;

	/** Responsibilities: _classification binary expressions compare_. **/
	private is_undefined_comparison(undefined_test: ts.BinaryExpression): boolean {
		const operator = undefined_test.operatorToken.kind;
		if (this._comparison_operators.has(operator)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _expression resolution validation_. **/
	private checked_expression(operand_comparison: ts.BinaryExpression): ts.Expression {
		if (ts.isIdentifier(operand_comparison.left) && operand_comparison.left.text === UNDEFINED_TYPE_NAME) {
			return operand_comparison.right;
		}
		if (ts.isIdentifier(operand_comparison.right) && operand_comparison.right.text === UNDEFINED_TYPE_NAME) {
			return operand_comparison.left;
		}
		return operand_comparison;
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
	private required_field(receiver: ts.Expression, property_name: string): boolean {
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		if (property_name === "") {
			return false;
		}
		return this._resolver.field_state(receiver, property_name) === PROPERTY_STATE_REQUIRED;
	}

	/** Responsibilities: _known field expressions_. **/
	private required_field_expression(property_expression: ts.Expression): boolean {
		const unwrapped_expression = this.unwrapped_key(property_expression);
		if (ts.isPropertyAccessExpression(unwrapped_expression)) {
			return this.required_field(unwrapped_expression.expression, unwrapped_expression.name.text);
		}
		if (!ts.isElementAccessExpression(unwrapped_expression)) {
			return false;
		}
		return this.required_field(unwrapped_expression.expression, this.element_name(unwrapped_expression));
	}

	/** Responsibilities: _classification undefined comparison targets_. **/
	private is_unnecessary_comparison(candidate_comparison: ts.BinaryExpression): boolean {
		if (!this.is_undefined_comparison(candidate_comparison)) {
			return false;
		}
		const checked_value = this.checked_expression(candidate_comparison);
		return this.required_field_expression(checked_value);
	}

	/** Responsibilities: _classification property access known_. **/
	private is_unnecessary_access(optional_access: ts.PropertyAccessExpression): boolean {
		if (optional_access.questionDotToken === undefined) {
			return false;
		}
		const receiver = this.unwrapped_key(optional_access.expression);
		if (!ts.isIdentifier(receiver)) {
			return false;
		}
		return this._resolver.field_state(receiver, optional_access.name.text) === PROPERTY_STATE_REQUIRED;
	}

	/** Responsibilities: _optional element access classification_. **/
	private unnecessary_element(optional_access: ts.ElementAccessExpression): boolean {
		if (optional_access.questionDotToken === undefined) {
			return false;
		}
		return this.required_field(optional_access.expression, this.element_name(optional_access));
	}

	/** Responsibilities: _initialization source property state_. **/
	public constructor(
		source_file: ts.SourceFile,
		append_rule: CallableRuleAppender,
		source_resolver: SourceFileResolver,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this._comparison_operators = new Set([
			ts.SyntaxKind.EqualsEqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsToken,
			ts.SyntaxKind.ExclamationEqualsToken,
		]);
		this._resolver = new AstPropertyType(source_file, source_resolver, module_exports, source_index);
		this._append_rule = append_rule;
	}

	/** Responsibilities: _reporting node contains unnecessary_. **/
	public matches(candidate_node: ts.Node): boolean {
		if (ts.isBinaryExpression(candidate_node)) {
			return this.is_unnecessary_comparison(candidate_node);
		}
		if (!ts.isPropertyAccessExpression(candidate_node)) {
			if (!ts.isElementAccessExpression(candidate_node)) {
				return false;
			}
			return this.unnecessary_element(candidate_node);
		}
		return this.is_unnecessary_access(candidate_node);
	}

	/** Responsibilities: _aggregation diagnostic node violates_. **/
	public append(candidate_node: ts.Node): void {
		if (this.matches(candidate_node)) {
			this._append_rule(candidate_node, RULE_IDS.unnecessary_undefined_check);
		}
	}
}
