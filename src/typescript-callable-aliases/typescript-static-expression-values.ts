import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptStaticExpressionBindings } from 'src/typescript-callable-aliases/typescript-static-expression-bindings';
import { TypeScriptStaticExpressionOperations } from 'src/typescript-callable-aliases/typescript-static-expression-operations';

/** Responsibilities: _static expression value resolution_. **/
export class TypeScriptStaticExpressionValues {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly operations = new TypeScriptStaticExpressionOperations();

	/** Responsibilities: _static value declaration_. **/
	private append_declaration(values: Map<string, string>, node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined || !ts.isIdentifier(node.name)) {
			return false;
		}
		return this.operations.append(values, node.name.text, node.initializer);
	}

	/** Responsibilities: _static value assignment_. **/
	private append_assignment(values: Map<string, string>, node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return false;
		}
		return this.operations.append(values, node.left.text, node.right);
	}

	private readonly bindings: TypeScriptStaticExpressionBindings;

	/** Responsibilities: _static assignment value collection_. **/
	private append_assignment_node(values: Map<string, string>, node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		let changed = this.bindings.append_assignment(node);
		if (this.append_assignment(values, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _static declaration value collection_. **/
	private append_declaration_node(values: Map<string, string>, node: ts.Node): boolean {
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		let changed = this.bindings.append(values, node);
		if (this.append_declaration(values, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _static value declaration collection_. **/
	private append_node(values: Map<string, string>, node: ts.Node, root: ts.Node): boolean {
		if (node !== root && ts.isFunctionLike(node)) {
			return false;
		}
		let changed = this.append_declaration_node(values, node);
		if (this.append_assignment_node(values, node)) {
			changed = true;
		}
		node.forEachChild(child => {
			if (this.append_node(values, child, root)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _static value scope collection_. **/
	private collect(scope: ts.Node): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		let changed = true;
		while (changed) {
			changed = this.append_node(values, scope, scope);
		}
		return values;
	}

	/** Responsibilities: _static value scope lookup_. **/
	private scopes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes;
	}

	/** Responsibilities: _static expression value dependencies_. **/
	public constructor() {
		this.bindings = new TypeScriptStaticExpressionBindings(
			(values, name, initializer) => this.operations.append(values, name, initializer)
		);
	}

	/** Responsibilities: _static value map resolution_. **/
	public values(node: ts.Node): ReadonlyMap<string, string> {
		const values = new Map<string, string>();
		for (const scope of this.scopes(node)) {
			for (const [name, value] of this.collect(scope)) {
				values.set(name, value);
			}
		}
		return values;
	}

	/** Responsibilities: _static value resolution_. **/
	public value(expression: ts.Expression, node: ts.Node): string {
		const values = this.values(node);
		const literal = this.operations.literal(values, expression);
		if (literal !== '') {
			return literal;
		}
		const current = this.expression_aliases.unwrapped(expression);
		if (!ts.isIdentifier(current)) {
			return '';
		}
		const value = values.get(current.text);
		if (value === undefined) {
			return '';
		}
		return value;
	}
}
