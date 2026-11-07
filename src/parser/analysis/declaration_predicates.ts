import type { ConstructorRulesContract, DeclarationPredicatesContract } from "src/parser/analysis/protocols";
import ts from "typescript";

/** Responsibilities: _static declaration detection_, _temporary access analysis_. **/
export class DeclarationPredicates implements DeclarationPredicatesContract {
	private readonly _static_kind: ts.SyntaxKind;
	private readonly _constructor_rules: ConstructorRulesContract;

	/** Responsibilities: _classification method declaration static_. **/
	private has_static_method(node: ts.HasModifiers): boolean {
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === this._static_kind);
	}

	/** Responsibilities: _temporary receiver wrapper removal_. **/
	private unwrap_receiver(receiver: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(receiver)) {
			return receiver.expression;
		}
		if (ts.isAsExpression(receiver) || ts.isTypeAssertionExpression(receiver)) {
			return receiver.expression;
		}
		if (ts.isNonNullExpression(receiver) || ts.isSatisfiesExpression(receiver)) {
			return receiver.expression;
		}
		return receiver;
	}

	/** Responsibilities: _temporary receiver normalization_. **/
	private normalized_receiver(receiver: ts.Expression): ts.Expression {
		let current = this.unwrap_receiver(receiver);
		while (true) {
			const next = this.unwrap_receiver(current);
			if (next === current) {
				return current;
			}
			current = next;
		}
	}

	/** Responsibilities: _temporary receiver classification_. **/
	private temporary_receiver(expression: ts.Expression): boolean {
		let receiver = this.normalized_receiver(expression);
		while (ts.isPropertyAccessExpression(receiver) || ts.isElementAccessExpression(receiver)) {
			receiver = this.normalized_receiver(receiver.expression);
		}
		if (ts.isNewExpression(receiver)) {
			return true;
		}
		if (ts.isArrayLiteralExpression(receiver)) {
			return receiver.elements.some((element) => ts.isSpreadElement(element));
		}
		if (ts.isObjectLiteralExpression(receiver)) {
			return receiver.properties.some((property) => ts.isSpreadAssignment(property));
		}
		return false;
	}

	/** Responsibilities: _indexed call receiver classification_. **/
	private call_index_receiver(access: ts.ElementAccessExpression): boolean {
		let receiver = this.normalized_receiver(access.expression);
		while (ts.isPropertyAccessExpression(receiver)) {
			receiver = this.normalized_receiver(receiver.expression);
		}
		return ts.isCallExpression(receiver);
	}

	/** Responsibilities: _temporary receiver members_. **/
	private temporary_call_access(node: ts.CallExpression): boolean {
		const expression = node.expression;
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		return this.temporary_receiver(expression.expression);
	}

	/** Responsibilities: _temporary member access_. **/
	private temporary_member_access(access: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(access) && !ts.isElementAccessExpression(access)) {
			return false;
		}
		if (ts.isElementAccessExpression(access) && this.call_index_receiver(access)) {
			return true;
		}
		if (!this.outermost_constructor_access(access)) {
			return false;
		}
		return this.temporary_receiver(access.expression);
	}

	/** Responsibilities: _constructor access chain_. **/
	private outermost_constructor_access(node: ts.Expression): boolean {
		const parent = node.parent;
		if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
			return false;
		}
		if (ts.isElementAccessExpression(parent) && parent.expression === node) {
			return false;
		}
		if (ts.isCallExpression(parent) && parent.expression === node) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _reporting static method field_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(constructor_rules: ConstructorRulesContract) {
		this._static_kind = ts.SyntaxKind.StaticKeyword;
		this._constructor_rules = constructor_rules;
	}
	/** Responsibilities: _public operation_. **/
	public static_declaration(declaration_node: ts.Node): boolean {
		if (ts.isMethodDeclaration(declaration_node)) {
			return this.has_static_method(declaration_node);
		}
		if (ts.isGetAccessor(declaration_node)) {
			return this.has_static_method(declaration_node);
		}
		if (ts.isSetAccessor(declaration_node)) {
			return this.has_static_method(declaration_node);
		}
		if (!ts.isPropertyDeclaration(declaration_node)) {
			return false;
		}
		const modifiers = ts.getModifiers(declaration_node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === this._static_kind);
	}

	/** Responsibilities: _temporary result access_. **/
	public temporary_result_access(expression_candidate: ts.Node): boolean {
		if (ts.isCallExpression(expression_candidate)) {
			return this.temporary_call_access(expression_candidate);
		}
		if (ts.isPropertyAccessExpression(expression_candidate)) {
			return this.temporary_member_access(expression_candidate);
		}
		if (ts.isElementAccessExpression(expression_candidate)) {
			return this.temporary_member_access(expression_candidate);
		}
		return false;
	}

	/** Responsibilities: _report constructor parameter properties_. **/
	public parameter_property(parameter_node: ts.Node): boolean {
		if (!ts.isParameter(parameter_node) || !ts.isConstructorDeclaration(parameter_node.parent)) {
			return false;
		}
		return ts.isParameterPropertyDeclaration(parameter_node, parameter_node.parent);
	}

	/** Responsibilities: _reporting constructors complex initialization_. **/
	public complex_constructor(constructor_node: ts.Node): boolean {
		if (!ts.isConstructorDeclaration(constructor_node) || !constructor_node.body) {
			return false;
		}
		return constructor_node.body.statements.some((statement) => !this._constructor_rules.statement_allowed(statement));
	}

	/** Responsibilities: _instance field initialization classification_. **/
	public complex_field(field_node: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(field_node) || this.static_declaration(field_node)) {
			return false;
		}
		return !this._constructor_rules.field_initializer_allowed(field_node);
	}
}
