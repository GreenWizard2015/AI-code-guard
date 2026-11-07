import type { TypeScriptInstanceFilesContract } from "src/model/protocols";
import ts from "typescript";

/** Responsibilities: _file identity_, _declaration aliases_. **/
export class TypeScriptInstanceFileIdentity {
	private readonly _imported_binding_files: ReadonlyMap<string, string>;
	private readonly _instance_files: TypeScriptInstanceFilesContract;

	/** Responsibilities: _imported instance file lookup_. **/
	private imported_file(name: string): string {
		const file = this._imported_binding_files.get(name);
		if (file === undefined) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _transparent initializer normalization_. **/
	private next_initializer(wrapper_expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isAsExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isSatisfiesExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		if (ts.isTypeAssertionExpression(wrapper_expression)) {
			return wrapper_expression.expression;
		}
		return wrapper_expression;
	}

	/** Responsibilities: _transparent initializer unwrapping_. **/
	private unwrapped_initializer(initializer_expression: ts.Expression): ts.Expression {
		let current = initializer_expression;
		while (true) {
			const next = this.next_initializer(current);
			if (next === current) {
				return current;
			}
			current = next;
		}
	}

	/** Responsibilities: _constructor expression file resolution_. **/
	private expression_file(source_expression: ts.Expression): string {
		const initializer = this.unwrapped_initializer(source_expression);
		if (!ts.isNewExpression(initializer) && !ts.isCallExpression(initializer)) {
			return "";
		}
		if (!ts.isIdentifier(initializer.expression)) {
			return "";
		}
		return this.imported_file(initializer.expression.text);
	}

	/** Responsibilities: _declaration initializer file resolution_. **/
	private declaration_file(initialized_declaration: ts.Node): string {
		if (!ts.isVariableDeclaration(initialized_declaration) && !ts.isParameter(initialized_declaration)) {
			return "";
		}
		if (initialized_declaration.initializer === undefined) {
			return "";
		}
		return this.expression_file(initialized_declaration.initializer);
	}

	/** Responsibilities: _type reference name resolution_. **/
	private type_name(typed_declaration: ts.Node): string {
		if (!ts.isVariableDeclaration(typed_declaration) && !ts.isParameter(typed_declaration)) {
			return "";
		}
		const type = typed_declaration.type;
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
	private type_file(typed_declaration: ts.Node): string {
		const name = this.type_name(typed_declaration);
		if (name.length === 0) {
			return "";
		}
		return this.imported_file(name);
	}

	/** Responsibilities: _variable alias file resolution_. **/
	private alias_file(alias_declaration: ts.VariableDeclaration): string {
		if (alias_declaration.initializer === undefined) {
			return "";
		}
		const unwrapped = this.unwrapped_initializer(alias_declaration.initializer);
		if (!ts.isIdentifier(unwrapped)) {
			return "";
		}
		return this._instance_files.instance_file(unwrapped.text, alias_declaration);
	}

	/** Responsibilities: _instance file resolver initialization_. **/
	public constructor(
		imported_binding_files: ReadonlyMap<string, string>,
		instance_files: TypeScriptInstanceFilesContract,
	) {
		this._imported_binding_files = imported_binding_files;
		this._instance_files = instance_files;
	}

	/** Responsibilities: _assignment receiver file resolution_. **/
	public assignment_file(assignment: ts.BinaryExpression): string {
		const initializer = this.unwrapped_initializer(assignment.right);
		if (ts.isIdentifier(initializer)) {
			return this._instance_files.instance_file(initializer.text, assignment);
		}
		return this.expression_file(initializer);
	}

	/** Responsibilities: _instance file resolution_. **/
	public file(file_query: ts.Node): string {
		let file = this.declaration_file(file_query);
		if (file.length === 0) {
			file = this.type_file(file_query);
		}
		if (file.length === 0 && ts.isVariableDeclaration(file_query)) {
			file = this.alias_file(file_query);
		}
		if (file.length === 0 && ts.isBinaryExpression(file_query) && ts.isIdentifier(file_query.left)) {
			file = this.assignment_file(file_query);
		}
		return file;
	}
}
