import { DeclarationPredicates } from 'src/bridge/ts/runner/declaration-predicates';
import { TypeScriptAssignmentValuePredicates } from 'src/bridge/ts/parser-internals/typescript-assignment-value-predicates';
import { TypeScriptAliasPair } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-alias-pair';
import { DynamicRuntimeUsage } from 'src/bridge/ts/parser-internals/dynamic-runtime-usage';
import { TypeScriptCallableFeatureDetection } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-callable-feature-detection';
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

	/** Responsibilities: _overload declarations detection_. **/
	private overload(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			if (node.body !== undefined) {
				return false;
			}
			return this.function_statements(node).some(statement =>
				ts.isFunctionDeclaration(statement) && statement.body !== undefined && this.same_name(node, statement)
			);
		}
		if (!ts.isMethodDeclaration(node) || node.body !== undefined) {
			return false;
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

	/** Responsibilities: _detection missing arrow output_. **/
	private named_arrow_missing(node: ts.ArrowFunction): boolean {
		if (!ts.isVariableDeclaration(node.parent)) {
			return false;
		}
		if (!ts.isIdentifier(node.parent.name)) {
			return false;
		}
		if (node.parent.type !== undefined) {
			return false;
		}
		return node.type === undefined;
	}

	/** Responsibilities: _detection missing function-expression output_. **/
	private named_expression_missing(node: ts.FunctionExpression): boolean {
		if (!ts.isVariableDeclaration(node.parent)) {
			return false;
		}
		if (!ts.isIdentifier(node.parent.name)) {
			return false;
		}
		if (node.parent.type !== undefined) {
			return false;
		}
		return node.type === undefined;
	}

	/** Responsibilities: _aggregation explicit result-type rules_. **/
	private append_return_rule(node: ts.Node, append_rule: RuleAppender): void {
		let missing = this.declaration_missing(node);
		if (ts.isArrowFunction(node)) {
			missing = this.named_arrow_missing(node);
		}
		if (ts.isFunctionExpression(node)) {
			missing = this.named_expression_missing(node);
		}
		if (missing) {
			append_rule(node, 'explicit-return-type');
		}
	}

	/** Responsibilities: _membership-operator rules addition_. **/
	private append_membership_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (ts.isIfStatement(node) && this.dynamic_runtime_usage.in_operator(node, node.getSourceFile())) {
			append_rule(node, 'typescript-in-operator');
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
		if (ts.isIfStatement(node) && this.callable_feature_detection.feature_detection(node)) {
			append_rule(node, 'python-callable');
		}
		this.append_return_rule(node, append_rule);
		this.append_membership_rule(node, append_rule);
		this.append_catch_rule(node, append_rule);
		this.append_typeof_rule(node, append_rule);
		this.append_type_assertion(node, append_rule);
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
			append_rule(node, INSTANCEOF);
		}
	}

	/** Responsibilities: _alias rules addition_. **/
	public append_alias_rules(node: ts.Node, append_rule: RuleAppender): void {
		if (this.alias_pair.alias_pair(node)) {
			append_rule(node, SINGULAR_PLURAL_ALIAS);
		}
	}
}
