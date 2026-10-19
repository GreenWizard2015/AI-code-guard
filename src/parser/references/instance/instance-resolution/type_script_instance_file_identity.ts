import ts from "typescript";
import type { TypeScriptInstanceFilesContract } from "src/model/protocols";

/** Responsibilities: _file identity_, _declaration aliases_. **/
export class TypeScriptInstanceFileIdentity {
	private readonly imported_binding_files: ReadonlyMap<string, string>;
	private readonly instance_files: TypeScriptInstanceFilesContract;

	/** Responsibilities: _imported instance file lookup_. **/
	private imported_file(name: string): string {
		const file = this.imported_binding_files.get(name);
		if (file === undefined) {
			return "";
		}
		return file;
	}

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

	/** Responsibilities: _constructor expression file resolution_. **/
	private expression_file(expression: ts.Expression): string {
		const initializer = this.unwrapped_initializer(expression);
		if (!ts.isNewExpression(initializer) && !ts.isCallExpression(initializer)) {
			return "";
		}
		if (!ts.isIdentifier(initializer.expression)) {
			return "";
		}
		return this.imported_file(initializer.expression.text);
	}

	/** Responsibilities: _declaration initializer file resolution_. **/
	private declaration_file(node: ts.Node): string {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return "";
		}
		if (node.initializer === undefined) {
			return "";
		}
		return this.expression_file(node.initializer);
	}

	/** Responsibilities: _type reference name resolution_. **/
	private type_name(node: ts.Node): string {
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

	/** Responsibilities: _typed declaration file resolution_. **/
	private type_file(node: ts.Node): string {
		const name = this.type_name(node);
		if (name.length === 0) {
			return "";
		}
		return this.imported_file(name);
	}

	/** Responsibilities: _variable alias file resolution_. **/
	private alias_file(node: ts.VariableDeclaration): string {
		if (node.initializer === undefined) {
			return "";
		}
		const unwrapped = this.unwrapped_initializer(node.initializer);
		if (!ts.isIdentifier(unwrapped)) {
			return "";
		}
		return this.instance_files.instance_file(unwrapped.text, node);
	}

	/** Responsibilities: _instance file resolver initialization_. **/
	public constructor(
		imported_binding_files: ReadonlyMap<string, string>,
		instance_files: TypeScriptInstanceFilesContract,
	) {
		this.imported_binding_files = imported_binding_files;
		this.instance_files = instance_files;
	}

	/** Responsibilities: _assignment receiver file resolution_. **/
	public assignment_file(node: ts.BinaryExpression): string {
		const initializer = this.unwrapped_initializer(node.right);
		if (ts.isIdentifier(initializer)) {
			return this.instance_files.instance_file(initializer.text, node);
		}
		return this.expression_file(initializer);
	}

	/** Responsibilities: _instance file resolution_. **/
	public file(node: ts.Node): string {
		let file = this.declaration_file(node);
		if (file.length === 0) {
			file = this.type_file(node);
		}
		if (file.length === 0) {
			if (ts.isVariableDeclaration(node)) {
				file = this.alias_file(node);
			}
		}
		if (file.length === 0) {
			if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
				file = this.assignment_file(node);
			}
		}
		return file;
	}
}
