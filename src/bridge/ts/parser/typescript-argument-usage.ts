import ts from 'typescript';

/** Responsibilities: _TypeScript callable argument count_. **/
export class TypeScriptArgumentUsage {
	private readonly property_name_kinds = new Set([
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.PropertyAssignment,
	]);

	/** Responsibilities: _increment usage identifier refers_. **/
	private increment_usage(counts: Map<string, number>, node: ts.Node): void {
		if ((!ts.isIdentifier(node)) || (!counts.has(node.text)) || this.is_property_name(node)) {
			return;
		}
		const count = counts.get(node.text);
		if (count !== undefined) {
			counts.set(node.text, count + 1);
		}
	}

	/** Responsibilities: _classification identifier usage property_. **/
	private is_property_name(node: ts.Identifier): boolean {
		if (!this.property_name_kinds.has(node.parent.kind)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.parent) && !ts.isPropertyAssignment(node.parent)) {
			return false;
		}
		if (node.parent.name === node) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _block-bodied callable preservation traversal_. **/
	private visit_body(node: ts.SignatureDeclarationBase, visit: (body: ts.Node) => void): void {
		if (ts.isFunctionDeclaration(node)) {
			if (node.body !== undefined) {
				visit(node.body);
			}
			return;
		}
		if (ts.isMethodDeclaration(node)) {
			if (node.body !== undefined) {
				visit(node.body);
			}
			return;
		}
		this.visit_accessor_body(node, visit);
		this.visit_callable_body(node, visit);
	}

	/** Responsibilities: _accessor bodies exposure traversal_. **/
	private visit_accessor_body(node: ts.SignatureDeclarationBase, visit: (body: ts.Node) => void): void {
if (!ts.isGetAccessorDeclaration(node) && !ts.isSetAccessorDeclaration(node)) {
			return;
		}
			if (node.body !== undefined) {
				visit(node.body);
			}
		}

	/** Responsibilities: _traversal function accessor dispatch_. **/
	private visit_callable_body(node: ts.SignatureDeclarationBase, visit: (body: ts.Node) => void): void {
		if ((!ts.isConstructorDeclaration(node)) && (!ts.isFunctionExpression(node)) && (!ts.isArrowFunction(node))) {
			return;
		}
		if (node.body !== undefined) {
			visit(node.body);
		}
	}

	/** Responsibilities: _initialization zero usage counts_. **/
	public initial_counts(node: ts.SignatureDeclarationBase): Map<string, number> {
		const counts = new Map<string, number>();
		for (const parameter of node.parameters) {
			if (ts.isIdentifier(parameter.name)) {
				counts.set(parameter.name.text, 0);
			}
		}
		return counts;
	}

	/** Responsibilities: _callable parameter reference count_. **/
	public collect_argument_usage(
		node: ts.SignatureDeclarationBase
	): { name: string; count: number }[] {
		const counts = this.initial_counts(node);
		if (!ts.isFunctionLike(node)) {
			return [...counts].map(([name, count]) => ({ name, count }));
		}
		const visit = (child: ts.Node): void => {
			this.increment_usage(counts, child);
			ts.forEachChild(child, visit);
		};
		this.visit_body(node, visit);
		return [...counts].map(([name, count]) => ({ name, count }));
	}
}
