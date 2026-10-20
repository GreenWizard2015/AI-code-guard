import ts from "typescript";
import type { ExpressionNamesContract } from "src/runtime_protocols";

/** Responsibilities: _forwarding callable detection_, _target expression support_. **/
export class ProxyCall {
	private readonly hidden_visibility_kinds: Set<ts.SyntaxKind>;
	private readonly expression_names: ExpressionNamesContract;

	/** Responsibilities: _classification declaration supported callable_. **/
	private is_callable_declaration(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return true;
		}
		if (!ts.isMethodDeclaration(node)) {
			return false;
		}
		return !node.modifiers?.some((modifier) => this.hidden_visibility_kinds.has(modifier.kind));
	}

	/** Responsibilities: _collection proxy invocation statement_. **/
	private statement_call(statement: ts.Statement): ts.Node[] {
		if (ts.isReturnStatement(statement)) {
			return this.return_statement_call(statement);
		}
		if (ts.isExpressionStatement(statement)) {
			return this.expression_statement_call(statement);
		}
		return [];
	}

	/** Responsibilities: _collection invocation output directly_. **/
	private return_statement_call(statement: ts.ReturnStatement): ts.Node[] {
		const expression = statement.expression;
		if (expression === undefined) {
			return [];
		}
		const unwrapped_expression = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isCallExpression(unwrapped_expression)) {
			return [unwrapped_expression];
		}
		if (ts.isNewExpression(unwrapped_expression)) {
			return [unwrapped_expression];
		}
		if (ts.isPropertyAccessExpression(unwrapped_expression)) {
			return [unwrapped_expression];
		}
		return [];
	}

	/** Responsibilities: _collection invocation output expression_. **/
	private expression_statement_call(statement: ts.ExpressionStatement): ts.Node[] {
		const expression = this.expression_names.unwrap_transparent_expression(statement.expression);
		if (ts.isCallExpression(expression)) {
			return [expression];
		}
		if (ts.isNewExpression(expression)) {
			return [expression];
		}
		return [];
	}

	/** Responsibilities: _collection proxy invocation arrow_. **/
	private arrow_call(node: ts.ArrowFunction): ts.Node[] {
		if (ts.isBlock(node.body)) {
			if (node.body.statements.length !== 1) {
				return [];
			}
			return this.statement_call(node.body.statements[0]);
		}
		const body = this.expression_names.unwrap_transparent_expression(node.body);
		if (ts.isCallExpression(body)) {
			return [body];
		}
		if (ts.isNewExpression(body)) {
			return [body];
		}
		if (ts.isPropertyAccessExpression(body)) {
			return [body];
		}
		return [];
	}

	/** Responsibilities: _collection proxy invocation function_. **/
	private function_call(node: ts.FunctionExpression): ts.Node[] {
		if (node.body.statements.length !== 1) {
			return [];
		}
		return this.statement_call(node.body.statements[0]);
	}

	/** Responsibilities: _collection proxy invocation function-like_. **/
	private declaration_call(node: ts.FunctionLikeDeclaration): ts.Node[] {
		if (node.body === undefined) {
			return [];
		}
		if (!ts.isBlock(node.body)) {
			return [];
		}
		if (node.body.statements.length !== 1) {
			return [];
		}
		return this.statement_call(node.body.statements[0]);
	}

	/** Responsibilities: _classification property access owner_. **/
	private supported_property_owner(owner: ts.Expression): boolean {
		if (owner.kind === ts.SyntaxKind.ThisKeyword) {
			return true;
		}
		if (ts.isPropertyAccessExpression(owner)) {
			return true;
		}
		if (!ts.isIdentifier(owner)) {
			return false;
		}
		if (owner.text[0] === "_") {
			return false;
		}
		return owner.text !== owner.text.toUpperCase();
	}

	/** Responsibilities: _collection proxy invocation nodes_. **/
	/** Responsibilities: _proxy state_. **/
	public constructor(expression_names: ExpressionNamesContract) {
		this.hidden_visibility_kinds = new Set([ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword]);
		this.expression_names = expression_names;
	}

	/** Responsibilities: _proxy invocation collection_. **/
	public proxy_call(node: ts.Node): ts.Node[] {
		if (ts.isArrowFunction(node)) {
			return this.arrow_call(node);
		}
		if (ts.isFunctionExpression(node)) {
			return this.function_call(node);
		}
		if (ts.isFunctionDeclaration(node)) {
			return this.declaration_call(node);
		}
		if (!ts.isMethodDeclaration(node)) {
			return [];
		}
		if (!this.is_callable_declaration(node)) {
			return [];
		}
		return this.declaration_call(node);
	}

	/** Responsibilities: _reporting expression proxy target_. **/
	public supports_target_expression(expression: ts.Expression): boolean {
		const target = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(target)) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(target)) {
			return false;
		}
		return this.supported_property_owner(target.expression);
	}
}
