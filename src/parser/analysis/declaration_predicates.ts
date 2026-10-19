import { ConstructorRules } from "src/parser/analysis/constructor_rules";
import ts from "typescript";

/** Responsibilities: _static declaration detection_, _temporary access analysis_. **/
export class DeclarationPredicates {
	private readonly static_kind = ts.SyntaxKind.StaticKeyword;
	private readonly constructor_rules: ConstructorRules;

	/** Responsibilities: _classification method declaration static_. **/
	private has_static_method(node: ts.HasModifiers): boolean {
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === this.static_kind);
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
		while (current !== receiver) {
			receiver = current;
			current = this.unwrap_receiver(receiver);
		}
		return current;
	}

	/** Responsibilities: _temporary constructor receiver_. **/
	private temporary_constructor_receiver(expression: ts.Expression): boolean {
		let receiver = this.normalized_receiver(expression);
		while (ts.isPropertyAccessExpression(receiver) || ts.isElementAccessExpression(receiver)) {
			receiver = this.normalized_receiver(receiver.expression);
		}
		return ts.isNewExpression(receiver);
	}

	/** Responsibilities: _temporary literal receiver_. **/
	private temporary_literal_receiver(expression: ts.Expression): boolean {
		let receiver = this.normalized_receiver(expression);
		while (ts.isPropertyAccessExpression(receiver) || ts.isElementAccessExpression(receiver)) {
			receiver = this.normalized_receiver(receiver.expression);
		}
		if (ts.isArrayLiteralExpression(receiver)) {
			return receiver.elements.some((element) => ts.isSpreadElement(element));
		}
		if (ts.isObjectLiteralExpression(receiver)) {
			return receiver.properties.some((property) => ts.isSpreadAssignment(property));
		}
		return false;
	}

	/** Responsibilities: _temporary access policy_. **/
	private call_index_receiver(expression: ts.Expression): boolean {
		let receiver = this.normalized_receiver(expression);
		while (ts.isPropertyAccessExpression(receiver)) {
			receiver = this.normalized_receiver(receiver.expression);
		}
		return ts.isCallExpression(receiver);
	}

	/** Responsibilities: _temporary receivers_. **/
	private temporary_receiver(expression: ts.Expression): boolean {
		const constructor_result = this.temporary_constructor_receiver(expression);
		const spread_result = this.temporary_literal_receiver(expression);
		return constructor_result || spread_result;
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
	private temporary_member_access(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		const indexed_call = ts.isElementAccessExpression(node) && this.call_index_receiver(node.expression);
		if (indexed_call || !this.outermost_constructor_access(node)) {
			return indexed_call;
		}
		return this.temporary_receiver(node.expression);
	}

	/** Responsibilities: _constructor access chain_. **/
	private outermost_constructor_access(node: ts.Expression): boolean {
		const parent = node.parent;
		if (ts.isPropertyAccessExpression(parent)) {
			if (parent.expression === node) {
				return false;
			}
		}
		if (ts.isElementAccessExpression(parent)) {
			if (parent.expression === node) {
				return false;
			}
		}
		if (ts.isCallExpression(parent)) {
			if (parent.expression === node) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _reporting static method field_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.constructor_rules = new ConstructorRules();
	}
	/** Responsibilities: _public operation_. **/
	public static_declaration(node: ts.Node): boolean {
		if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
			return this.has_static_method(node);
		}
		if (!ts.isPropertyDeclaration(node)) {
			return false;
		}
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === this.static_kind);
	}

	/** Responsibilities: _temporary result access_. **/
	public temporary_result_access(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			return this.temporary_call_access(node);
		}
		return this.temporary_member_access(node);
	}

	/** Responsibilities: _report constructor parameter properties_. **/
	public parameter_property(node: ts.Node): boolean {
		if (!ts.isParameter(node) || !ts.isConstructorDeclaration(node.parent)) {
			return false;
		}
		return ts.isParameterPropertyDeclaration(node, node.parent);
	}

	/** Responsibilities: _reporting constructors complex initialization_. **/
	public complex_constructor(node: ts.Node): boolean {
		if (!ts.isConstructorDeclaration(node) || !node.body) {
			return false;
		}
		return node.body.statements.some((statement) => !this.constructor_rules.statement_allowed(statement));
	}

	/** Responsibilities: _instance field initialization classification_. **/
	public complex_field(node: ts.Node): boolean {
		if (!ts.isPropertyDeclaration(node) || this.static_declaration(node)) {
			return false;
		}
		return !this.constructor_rules.field_initializer_allowed(node);
	}
}
