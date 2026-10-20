import { BROAD_CATCH, INSTANCEOF, OVERLOAD, TYPEOF, TYPE_ASSERTION } from "src/parser/internals/constants";
import { DynamicBindingNames } from "src/typescript-aliases/dynamic_binding_names";
import { TypeScriptInOperatorAliases } from "src/rules/typescript/syntax-rules/expressions/type_script_in_operator_aliases";
import { TypeScriptConditionExpression } from "src/parser/internals/type_script_condition_expression";
import { TypeScriptCallableFeatureDetection } from "src/rules/typescript/syntax-rules/callables/type_script_callable_feature_detection";
import { TypeScriptCatchClause } from "src/rules/typescript/syntax-rules/expressions/type_script_catch_clause";
import { TypeScriptCallableReturnRules } from "src/rules/typescript/syntax-rules/callables/type_script_callable_return_rules";
import { TypeScriptOverloadRules } from "src/rules/typescript/syntax-rules/callables/type_script_overload_rules";
import { ValueRules } from "src/linting/value_rules";
import type { TypeScriptExpressionRulesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { ValueRulesContract } from "src/analysis_protocols";
import type { RuleAppender } from "src/types";
import ts from "typescript";
import { RULE_IDS } from "src/constants";
import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";

/** Responsibilities: _expression rules_, _type boundaries_. **/
export class TypeScriptExpressionRules implements TypeScriptExpressionRulesContract {
	private readonly value_rules: ValueRulesContract;
	private readonly in_operator_aliases: TypeScriptInOperatorAliases;
	private readonly condition_expression: TypeScriptConditionExpression;
	private readonly callable_feature_detection: TypeScriptCallableFeatureDetection;
	private readonly callable_return_rules: TypeScriptCallableReturnRules;
	private readonly overload_rules: TypeScriptOverloadRules;
	private readonly callable_feature_kinds: Set<ts.SyntaxKind>;
	private readonly return_type_kinds: Set<ts.SyntaxKind>;
	private readonly membership_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _conditional in-operator usage_. **/
	private condition_in_operator(expression: ts.Expression, node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isBinaryExpression(expression)) {
			return this.in_operator_aliases.invalid(expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			return this.in_operator_aliases.aliases(node).has(expression.text);
		}
		return false;
	}

	/** Responsibilities: _dynamic in-operator usage identification_. **/
	private in_operator(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isIfStatement(node)) {
			const expression = this.condition_expression.unwrap(node.expression);
			return this.condition_in_operator(expression, node, source_file);
		}
		if (!ts.isBinaryExpression(node)) {
			if (!ts.isIdentifier(node)) {
				return false;
			}
			return this.in_operator_aliases.aliases(node).has(node.text);
		}
		const expression = this.condition_expression.unwrap(node);
		return this.condition_in_operator(expression, node, source_file);
	}

	/** Responsibilities: _explicit result rule addition_. **/
	private append_return_rule(node: ts.SignatureDeclaration, append_rule: RuleAppender): void {
		if (this.callable_return_rules.missing(node)) {
			append_rule(node, RULE_IDS.explicit_return_type);
		}
	}

	/** Responsibilities: _membership operator rule addition_. **/
	private append_membership_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isIfStatement(node)) {
			if (this.in_operator(node, node.getSourceFile())) {
				append_rule(node, RULE_IDS.typescript_in_operator);
			}
			return;
		}
		if (ts.isBinaryExpression(node) && this.in_operator(node, node.getSourceFile())) {
			append_rule(node, RULE_IDS.typescript_in_operator);
		}
	}

	/** Responsibilities: _prototype member classification_. **/
	private prototype_member(expression: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text === TYPESCRIPT_PROTOTYPE_NAME;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		const argument = expression.argumentExpression;
		if (!ts.isStringLiteral(argument)) {
			return false;
		}
		return argument.text === TYPESCRIPT_PROTOTYPE_NAME;
	}

	/** Responsibilities: _prototype check classification_. **/
	private prototype_check(node: ts.Node): boolean {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (node.expression.name.text !== "isPrototypeOf") {
			return false;
		}
		return this.prototype_member(node.expression.expression);
	}

	/** Responsibilities: _instanceof rule addition_. **/
	private append_instanceof_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isBinaryExpression(node)) {
			if (node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
				append_rule(node, INSTANCEOF);
			}
		}
		if (this.prototype_check(node)) {
			append_rule(node, INSTANCEOF);
		}
	}

	/** Responsibilities: _broad catch rule addition_. **/
	private append_catch_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (!ts.isCatchClause(node)) {
			return;
		}
		const catch_clause = new TypeScriptCatchClause(node);
		if (!catch_clause.reports_broad_catch()) {
			return;
		}
		append_rule(node, BROAD_CATCH);
	}

	/** Responsibilities: _repeated typeof rule addition_. **/
	private append_typeof_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isTypeOfExpression(node) && this.value_rules.repeated_typeof(node)) {
			append_rule(node, TYPEOF);
		}
	}

	/** Responsibilities: _type assertion rule addition_. **/
	private append_type_assertion(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isTypeAssertionExpression(node)) {
			append_rule(node, TYPE_ASSERTION);
			return;
		}
		if (!ts.isAsExpression(node)) {
			return;
		}
		if (node.type.getText(node.getSourceFile()) === "const") {
			return;
		}
		append_rule(node, TYPE_ASSERTION);
	}

	/** Responsibilities: _callable feature rule addition_. **/
	private append_feature(node: ts.Node, append_rule: RuleAppender): void {
		if (this.callable_feature_detection.feature_detection(node)) {
			append_rule(node, RULE_IDS.callable_feature_detection);
		}
	}

	/** Responsibilities: _overload declaration classification_. **/
	private overloaded_declaration(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return this.overload_rules.function_overload(node);
		}
		if (ts.isMethodDeclaration(node)) {
			return this.overload_rules.class_method_overload(node);
		}
		if (ts.isMethodSignature(node)) {
			return this.overload_rules.interface_method_overload(node);
		}
		return false;
	}

	/** Responsibilities: _declaration rule addition_. **/
	private append_declaration_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.overloaded_declaration(node)) {
			append_rule(node, OVERLOAD);
		}
		if (this.return_type_kinds.has(node.kind) && ts.isFunctionLike(node)) {
			this.append_return_rule(node, append_rule);
		}
	}

	/** Responsibilities: _control-flow expression rules_. **/
	private append_control_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.callable_feature_kinds.has(node.kind)) {
			this.append_feature(node, append_rule);
		}
		if (this.membership_kinds.has(node.kind)) {
			this.append_membership_rule(node, append_rule);
		}
	}

	/** Responsibilities: _terminal expression rules_. **/
	private append_terminal_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isCatchClause(node)) {
			this.append_catch_rule(node, append_rule);
		}
		if (ts.isTypeOfExpression(node)) {
			this.append_typeof_rule(node, append_rule);
		}
		if (ts.isTypeAssertionExpression(node) || ts.isAsExpression(node)) {
			this.append_type_assertion(node, append_rule);
		}
		if (ts.isBinaryExpression(node) || ts.isCallExpression(node)) {
			this.append_instanceof_rule(node, append_rule);
		}
	}

	/** Responsibilities: _expression rule aggregation_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this.callable_feature_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ConditionalExpression,
		]);
		this.return_type_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
		]);
		this.membership_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.BinaryExpression,
		]);
		this.value_rules = new ValueRules(variable_declaration_index);
		this.in_operator_aliases = new TypeScriptInOperatorAliases(new DynamicBindingNames());
		this.condition_expression = new TypeScriptConditionExpression();
		this.callable_feature_detection = new TypeScriptCallableFeatureDetection();
		this.callable_return_rules = new TypeScriptCallableReturnRules();
		this.overload_rules = new TypeScriptOverloadRules();
	}
	/** Responsibilities: _public operation_. **/
	public append(node: ts.Node, append_rule: RuleAppender): void {
		this.append_declaration_rules(node, append_rule);
		this.append_control_rules(node, append_rule);
		this.append_terminal_rules(node, append_rule);
	}
}
