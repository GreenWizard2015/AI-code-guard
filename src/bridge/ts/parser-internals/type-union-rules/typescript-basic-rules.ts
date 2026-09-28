import { DeclarationPredicates } from 'src/bridge/ts/runner/declaration-predicates';
import { TypeScriptAssignmentValuePredicates } from 'src/bridge/ts/parser-internals/typescript-assignment-value-predicates';
import { TypeScriptAliasPair } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-alias-pair';
import { DynamicRuntimeUsage } from 'src/bridge/ts/parser-internals/dynamic-runtime/dynamic-runtime-usage';
import { TypeScriptCallableFeatureDetection } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-callable-feature-detection';
import { TypeScriptCallableReturnRules } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-callable-return-rules';
import { ValueRules } from 'src/bridge/ts/runner/value-rules';
import ts from 'typescript';
import {
	BROAD_CATCH,
	COMPLEX_DEFAULT,
	INSTANCEOF,
	PARAMETER_PROPERTY,
	SINGULAR_PLURAL_ALIAS,
	TYPE_ASSERTION,
	TYPEOF,
	OVERLOAD,
} from 'src/bridge/ts/parser-internals/constants';
import type { RuleAppender } from 'src/types';

/** Responsibilities: _inspection TypeScript nodes validation_. **/
export class TypeScriptBasicRules {
	private readonly assignment_value_predicates = new TypeScriptAssignmentValuePredicates();
	private readonly declaration_predicates = new DeclarationPredicates();
	private readonly value_rules = new ValueRules();
	private readonly alias_pair = new TypeScriptAliasPair();
	private readonly dynamic_runtime_usage = new DynamicRuntimeUsage();
	private readonly callable_feature_detection = new TypeScriptCallableFeatureDetection();
	private readonly callable_return_rules = new TypeScriptCallableReturnRules();
	/** Responsibilities: _declaration names comparison_. **/
	private same_name(left: ts.NamedDeclaration, right: ts.NamedDeclaration): boolean {
		if (left.name === undefined || right.name === undefined) {
			return false;
		}
		return left.name.getText() === right.name.getText();
	}

	/** Responsibilities: _function declaration siblings lookup_. **/
	private function_statements(node: ts.FunctionDeclaration): readonly ts.Statement[] {
		const parent = node.parent;
		if (ts.isSourceFile(parent) || ts.isModuleBlock(parent) || ts.isBlock(parent)) {
			return parent.statements;
		}
		return [];
	}

	/** Responsibilities: _class method siblings lookup_. **/
	private class_members(node: ts.MethodDeclaration): readonly ts.ClassElement[] {
		const parent = node.parent;
		if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _interface method siblings lookup_. **/
	private interface_members(node: ts.MethodSignature): readonly ts.TypeElement[] {
		const parent = node.parent;
		if (ts.isInterfaceDeclaration(parent) || ts.isTypeLiteralNode(parent)) {
			return parent.members;
		}
		return [];
	}

	/** Responsibilities: _overload declarations detection_. **/
	private overload(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			if (node.body !== undefined) {
				return false;
			}
			return this.function_statements(node).some(statement =>
				ts.isFunctionDeclaration(statement) && statement !== node && this.same_name(node, statement)
			);
		}
		if (!ts.isMethodDeclaration(node) || node.body !== undefined) {
			if (!ts.isMethodSignature(node)) {
				return false;
			}
			return this.interface_members(node).some(member =>
				ts.isMethodSignature(member) && this.same_name(node, member) && member !== node
			);
		}
		return this.class_members(node).some(member =>
			ts.isMethodDeclaration(member) && member.body !== undefined && this.same_name(node, member)
		);
	}

	/** Responsibilities: _detection missing callable output_. **/
	private declaration_missing(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return node.type === undefined;
		}
		if (ts.isMethodDeclaration(node)) {
			return node.type === undefined;
		}
		if (ts.isGetAccessorDeclaration(node)) {
			return node.type === undefined;
		}
		if (ts.isMethodSignature(node)) {
			return node.type === undefined;
		}
		return false;
	}

	/** Responsibilities: _aggregation explicit result-type rules_. **/
	private append_return_rule(node: ts.Node, append_rule: RuleAppender): void {
		let missing = this.declaration_missing(node);
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			missing = this.callable_return_rules.missing(node);
		}
		if (missing) {
			append_rule(node, 'explicit-return-type');
		}
	}

	/** Responsibilities: _membership-operator rules addition_. **/
	private append_membership_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isIfStatement(node)) {
			if (this.dynamic_runtime_usage.in_operator(node, node.getSourceFile())) {
				append_rule(node, 'typescript-in-operator');
			}
			return;
		}
		if (ts.isBinaryExpression(node) && this.dynamic_runtime_usage.in_operator(node, node.getSourceFile())) {
			append_rule(node, 'typescript-in-operator');
		}
	}

	/** Responsibilities: _prototype member classification_. **/
	private prototype_member(expression: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text === 'prototype';
		}
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		const argument = expression.argumentExpression;
		return ts.isStringLiteral(argument) && argument.text === 'prototype';
	}

	/** Responsibilities: _prototype check classification_. **/
	private prototype_check(node: ts.Node): boolean {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (node.expression.name.text !== 'isPrototypeOf') {
			return false;
		}
		return this.prototype_member(node.expression.expression);
	}

	/** Responsibilities: _instanceof rule addition_. **/
	private append_instanceof_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
			append_rule(node, INSTANCEOF);
		}
		if (this.prototype_check(node)) {
			append_rule(node, INSTANCEOF);
		}
	}

	/** Responsibilities: _broad-catch rules addition_. **/
	private append_catch_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isCatchClause(node) && !node.variableDeclaration) {
			append_rule(node, BROAD_CATCH);
		}
	}

	/** Responsibilities: _repeated-typeof rules addition_. **/
	private append_typeof_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isTypeOfExpression(node) && this.value_rules.repeated_typeof(node)) {
			append_rule(node, TYPEOF);
		}
	}

	/** Responsibilities: _type-assertion rules addition_. **/
	private append_type_assertion(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isTypeAssertionExpression(node)) {
			append_rule(node, TYPE_ASSERTION);
			return;
		}
		if (!ts.isAsExpression(node)) {
			return;
		}
		if (node.type.getText(node.getSourceFile()) === 'const') {
			return;
		}
		append_rule(node, TYPE_ASSERTION);
	}

	/** Responsibilities: _parameter rules addition_. **/
	public append_parameter_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isParameter(node) && node.initializer !== undefined) {
			if (!this.assignment_value_predicates.primitive_expression(node.initializer)) {
				append_rule(node, COMPLEX_DEFAULT);
			}
		}
		if (this.declaration_predicates.parameter_property(node)) {
			append_rule(node, PARAMETER_PROPERTY);
		}
	}

	/** Responsibilities: _expression rules addition_. **/
	public append_expression_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.overload(node)) {
			append_rule(node, OVERLOAD);
		}
		if (this.callable_feature_detection.feature_detection(node)) {
			append_rule(node, 'python-callable');
		}
		this.append_return_rule(node, append_rule);
		this.append_membership_rule(node, append_rule);
		this.append_catch_rule(node, append_rule);
		this.append_typeof_rule(node, append_rule);
		this.append_type_assertion(node, append_rule);
		this.append_instanceof_rule(node, append_rule);
	}

	/** Responsibilities: _alias rules addition_. **/
	public append_alias_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.alias_pair.alias_pair(node)) {
			append_rule(node, SINGULAR_PLURAL_ALIAS);
		}
	}
}
