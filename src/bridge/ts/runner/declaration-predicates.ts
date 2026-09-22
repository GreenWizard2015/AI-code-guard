import { ConstructorRules } from 'src/bridge/ts/runner/constructor-rules';
import { ProxyRules } from 'src/bridge/ts/runner/proxy-rules';
import ts from 'typescript';


/** Responsibilities: _classification TypeScript declarations static_. **/
export class DeclarationPredicates {
	private readonly static_kind = ts.SyntaxKind.StaticKeyword;
	private readonly assignment_kind = ts.SyntaxKind.EqualsToken;

	/** Responsibilities: _classification method declaration static_. **/
	private has_static_method(node: ts.MethodDeclaration): boolean {
		if (node.modifiers === undefined) {
			return false;
		}
		return node.modifiers.some(modifier => modifier.kind === this.static_kind);
	}

	/** Responsibilities: _classification property declaration static_. **/
	private has_static_field(node: ts.PropertyDeclaration): boolean {
		if (node.modifiers === undefined) {
			return false;
		}
		return node.modifiers.some(modifier => modifier.kind === this.static_kind);
	}

	/** Responsibilities: _classification assignment targets prototype_. **/
	private has_prototype_target(node: ts.Node): boolean {
		const proxy_rules = new ProxyRules();

if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== this.assignment_kind) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return false;
		}
		return proxy_rules.property_chain(node.left).includes('prototype');
	}

	/** Responsibilities: _reporting static method field_. **/
	public static_declaration(node: ts.Node): boolean {
		if (ts.isMethodDeclaration(node)) {
			return this.has_static_method(node);
		}
		if (ts.isPropertyDeclaration(node)) {
			return this.has_static_field(node);
		}
		return false;
	}

	/** Responsibilities: _reporting assignments prototype members_. **/
	public prototype_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.has_prototype_target(node);
	}

	/** Responsibilities: _reporting method invocation temporary_. **/
	public temp_method(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return ts.isNewExpression(node.expression.expression);
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
		const constructor_rules = new ConstructorRules();

		if (!ts.isConstructorDeclaration(node) || !node.body) {
			return false;
		}
		return node.body.statements.some(statement => !constructor_rules.statement_allowed(statement));
	}
}
