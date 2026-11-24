import ts from "typescript";

/** Responsibilities: _candidate declaration state_, _candidate field state_. **/
export class ProxyFieldAccessorCandidate {
	private readonly _callable: ts.Node;
	private readonly _expression: ts.Node;

	/** Responsibilities: _backing field identity_. **/
	private matches_backing_field(property: ts.PropertyAccessExpression): boolean {
		if (!ts.isMethodDeclaration(this._callable)) {
			return false;
		}
		const method_name = this._callable.name;
		if (!ts.isIdentifier(method_name)) {
			return false;
		}
		const field_name = property.name.text.replace(/^_+/u, "");
		return method_name.text === field_name;
	}

	/** Responsibilities: _same class getter lookup_. **/
	private class_getter_exists(property: ts.PropertyAccessExpression): boolean {
		const class_declaration = this._callable.parent;
		if (!ts.isClassDeclaration(class_declaration)) {
			return false;
		}
		for (const member of class_declaration.members) {
			if (!ts.isGetAccessor(member)) {
				continue;
			}
			const getter_name = member.name;
			if (!ts.isIdentifier(getter_name)) {
				continue;
			}
			if (getter_name.text === property.name.text) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _field accessor candidate initialization_. **/
	public constructor(callable: ts.Node, expression: ts.Node) {
		this._callable = callable;
		this._expression = expression;
	}

	/** Responsibilities: _contract implementation classification_. **/
	public implements_contract(): boolean {
		if (!ts.isMethodDeclaration(this._callable) || !ts.isClassDeclaration(this._callable.parent)) {
			return false;
		}
		const heritage_clauses = this._callable.parent.heritageClauses;
		if (heritage_clauses === undefined) {
			return false;
		}
		for (const clause of heritage_clauses) {
			if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _instance property forwarding classification_. **/
	public returns_this_property(): boolean {
		if (!ts.isMethodDeclaration(this._callable)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(this._expression)) {
			return false;
		}
		const property = this._expression;
		if (property.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return false;
		}
		if (this.matches_backing_field(property)) {
			return true;
		}
		return this.class_getter_exists(property);
	}
}
