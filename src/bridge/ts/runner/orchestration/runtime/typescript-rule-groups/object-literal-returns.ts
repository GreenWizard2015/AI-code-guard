import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { FakeObject } from 'src/bridge/ts/runner/fake-object';
import ts from 'typescript';

/** Responsibilities: _resolution contract output types_. **/
export class ObjectLiteralReturns {
	private readonly rule = new DiagnosticRule('typescript-object-literal-return');
	private readonly fake_object = new FakeObject();
	private readonly contract_names: ReadonlySet<string>;
	private readonly function_parent_kinds = new Set([
		ts.SyntaxKind.FunctionDeclaration,
		ts.SyntaxKind.MethodDeclaration,
		ts.SyntaxKind.GetAccessor,
		ts.SyntaxKind.SetAccessor,
		ts.SyntaxKind.Constructor,
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ArrowFunction,
	]);

	/** Responsibilities: _resolution textual name output_. **/
	private type_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
	}

	/** Responsibilities: _classification type node references_. **/
	private contains_contract_type(node: ts.TypeNode): boolean {
		if (ts.isTypeReferenceNode(node)) {
			if (this.contract_names.has(this.type_name(node.typeName))) {
				return true;
			}
			const type_arguments = node.typeArguments;
			if (type_arguments === undefined) {
				return false;
			}
			return type_arguments.some(type_argument => this.contains_contract_type(type_argument));
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return node.types.some(type_part => this.contains_contract_type(type_part));
		}
		if (ts.isParenthesizedTypeNode(node)) {
			return this.contains_contract_type(node.type);
		}
		return false;
	}

	/** Responsibilities: _collection enclosing function-like declarations_. **/
	private containing_function(node: ts.Node): ts.SignatureDeclaration[] {
		let parent = node.parent;
		while (parent !== undefined) {
			const function_parent = this.function_parent(parent);
			if (function_parent.length > 0) {
				return function_parent;
			}
			parent = parent.parent;
		}
		return [];
	}

	/** Responsibilities: _resolution nearest function-like parent_. **/
	private function_parent(node: ts.Node): ts.SignatureDeclaration[] {
		if (!this.function_parent_kinds.has(node.kind)) {
			return [];
		}
		if (!ts.isFunctionLike(node)) {
			return [];
		}
		return [node];
	}

	/** Responsibilities: _unwrap conditional parenthesized expressions_. **/
	private unwrapped_expression(expression: ts.Expression): ts.Expression[] {
		if (ts.isParenthesizedExpression(expression)) {
			return [expression.expression];
		}
if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return [expression.expression];
		}
		if (ts.isSatisfiesExpression(expression)) {
			return [expression.expression];
		}
		return [];
	}

	/** Responsibilities: _collection object literals expression_. **/
	private object_literal(expression: ts.Expression): ts.ObjectLiteralExpression[] {
		let current = expression;
		while (true) {
			if (ts.isObjectLiteralExpression(current)) {
				return [current];
			}
			const expressions = this.unwrapped_expression(current);
			if (expressions.length === 0) {
				return [];
			}
			const next = expressions[0];
			current = next;
		}
	}

	/** Responsibilities: _aggregation diagnostic inline object_. **/
	private append_return_violation(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile,
		node: ts.ReturnStatement
	): void {
		if (!this.object_return(node)) {
			return;
		}
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
		violations.push(this.rule.violation(file, line));
	}

	/** Responsibilities: _initialization source context contract_. **/
	public constructor(
		project_contract_names: ReadonlySet<string>,
		local_type_aliases: ReadonlySet<string>
	) {
		this.contract_names = new Set(
			Array.from(project_contract_names).filter(name => !local_type_aliases.has(name))
		);
	}

	/** Responsibilities: _aggregation object-literal output violations_. **/
	public append_violations(
		violations: Violation[],
		file: string,
		source_file: ts.SourceFile
	): void {
		const visit = (node: ts.Node): void => {
			if (ts.isReturnStatement(node)) {
				this.append_return_violation(violations, file, source_file, node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _reporting output statement contains_. **/
	public object_return(node: ts.ReturnStatement): boolean {
		const expression = node.expression;
		if (expression === undefined) {
			return false;
		}
		const expressions = this.object_literal(expression);
		const object_literal = expressions[0];
if (object_literal === undefined || !this.fake_object.fake_object(object_literal)) {
			return false;
		}
		const callables = this.containing_function(node);
		const callable = callables[0];
return callable?.type !== undefined && this.contains_contract_type(callable.type);
	}

}
