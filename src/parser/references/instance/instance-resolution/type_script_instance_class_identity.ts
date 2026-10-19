import ts from "typescript";
import type { TypeScriptInstanceFilesContract } from "src/model/protocols";

/** Responsibilities: _initializer class resolution_, _assignment class identity lookup_. **/
export class TypeScriptInstanceClassIdentity {
	private readonly instance_files: TypeScriptInstanceFilesContract;

	/** Responsibilities: _transparent initializer normalization_. **/
	private next_initializer(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isAsExpression(expression)) {
			return expression.expression;
		}
		if (ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		if (ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _transparent initializer unwrapping_. **/
	private unwrapped_initializer(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			const next = this.next_initializer(current);
			if (next === current) {
				return current;
			}
			current = next;
		}
	}

	/** Responsibilities: _typed declaration class resolution_. **/
	private typed_name(node: ts.Node): string {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return "";
		}
		const type = node.type;
		if (type === undefined) {
			return "";
		}
		if (!ts.isTypeReferenceNode(type)) {
			return "";
		}
		if (!ts.isIdentifier(type.typeName)) {
			return "";
		}
		return type.typeName.text;
	}

	/** Responsibilities: _initializer class name resolution_. **/
	private initializer_class_name(node: ts.VariableDeclaration): string {
		if (node.initializer === undefined) {
			return "";
		}
		const unwrapped = this.unwrapped_initializer(node.initializer);
		if (ts.isNewExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
			return unwrapped.expression.text;
		}
		if (ts.isIdentifier(unwrapped)) {
			return this.instance_files.instance_class(unwrapped.text, node);
		}
		return "";
	}

	/** Responsibilities: _instance class resolver initialization_. **/
	public constructor(instance_files: TypeScriptInstanceFilesContract) {
		this.instance_files = instance_files;
	}

	/** Responsibilities: _assignment receiver class resolution_. **/
	public assignment_class_name(node: ts.BinaryExpression): string {
		const initializer = this.unwrapped_initializer(node.right);
		if (ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression)) {
			return initializer.expression.text;
		}
		if (ts.isIdentifier(initializer)) {
			return this.instance_files.instance_class(initializer.text, node);
		}
		return "";
	}

	/** Responsibilities: _instance class resolution_. **/
	public class_name(node: ts.Node): string {
		let class_name = "";
		if (ts.isVariableDeclaration(node)) {
			class_name = this.initializer_class_name(node);
		}
		if (class_name.length === 0) {
			class_name = this.typed_name(node);
		}
		if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
			const assignment_class_name = this.assignment_class_name(node);
			if (assignment_class_name.length > 0) {
				class_name = assignment_class_name;
			}
		}
		return class_name;
	}
}
