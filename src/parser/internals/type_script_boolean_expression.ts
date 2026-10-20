import { TypeScriptVariableBinding } from "src/linting/type_script_variable_binding";
import { TypeScriptBooleanDeclarationIndex } from "src/parser/internals/type_script_boolean_declaration_index";
import ts from "typescript";
import { BOOLEAN_OPERATOR_KINDS, COMPARISON_OPERATOR_KINDS } from "src/parser/internals/constants";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type { TypeScriptBooleanDeclarationIndexContract, TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { BooleanCallTarget } from "src/model/types/types";

/** Responsibilities: _boolean declaration resolution_, _boolean expression classification_. **/
export class TypeScriptBooleanExpression implements BooleanExpressionContract {
	private readonly variable_bindings: Map<ts.SourceFile, TypeScriptVariableBinding>;
	private readonly declaration_indexes: WeakMap<ts.SourceFile, TypeScriptBooleanDeclarationIndexContract>;
	private readonly variable_declaration_index: TypeScriptVariableDeclarationIndexContract;
	private readonly boolean_declarations: WeakMap<ts.VariableDeclaration, boolean>;
	private readonly active_boolean_declarations: WeakSet<ts.VariableDeclaration>;
	private readonly comparison_operator_kinds = COMPARISON_OPERATOR_KINDS;
	private readonly boolean_operator_kinds = BOOLEAN_OPERATOR_KINDS;

	/** Responsibilities: _source-file boolean declaration index_. **/
	private declaration_index(source_file: ts.SourceFile): TypeScriptBooleanDeclarationIndexContract {
		const cached = this.declaration_indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptBooleanDeclarationIndex();
		index.append(source_file);
		this.declaration_indexes.set(source_file, index);
		return index;
	}

	/** Responsibilities: _classification complex expression resolution_. **/
	private boolean_complex_expression(node: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.boolean_binary_expression(node, source_file);
		}
		if (ts.isIdentifier(node)) {
			return this.boolean_binding(node.text, source_file, node);
		}
		if (ts.isPropertyAccessExpression(node)) {
			return this.declaration_index(source_file).boolean_properties.has(node.name.text);
		}
		if (ts.isCallExpression(node)) {
			return this.boolean_call(node, source_file);
		}
		return false;
	}

	/** Responsibilities: _classification binary expression boolean_. **/
	private boolean_binary_expression(node: ts.BinaryExpression, source_file: ts.SourceFile): boolean {
		if (this.comparison_operator_kinds.includes(node.operatorToken.kind)) {
			return true;
		}
		if (!this.boolean_operator_kinds.includes(node.operatorToken.kind)) {
			return false;
		}
		if (!this.boolean_expression(node.left, source_file)) {
			return false;
		}
		return this.boolean_expression(node.right, source_file);
	}

	/** Responsibilities: _classification binding resolution boolean_. **/
	private boolean_binding(name: string, source_file: ts.SourceFile, reference: ts.Node): boolean {
		let bindings = this.variable_bindings.get(source_file);
		if (bindings === undefined) {
			bindings = new TypeScriptVariableBinding(source_file, this.variable_declaration_index);
			this.variable_bindings.set(source_file, bindings);
		}
		const declaration = bindings.declaration(name, reference);
		if (!ts.isVariableDeclaration(declaration)) {
			return false;
		}
		return this.boolean_declaration(declaration, name, source_file);
	}

	/** Responsibilities: _classification declaration establishes boolean_. **/
	private boolean_declaration(declaration: ts.VariableDeclaration, name: string, source_file: ts.SourceFile): boolean {
		const cached = this.boolean_declarations.get(declaration);
		if (cached !== undefined) {
			return cached;
		}
		if (this.active_boolean_declarations.has(declaration)) {
			return false;
		}
		this.active_boolean_declarations.add(declaration);
		let result = false;
		try {
			result = this.boolean_declaration_result(declaration, name, source_file);
		} finally {
			this.active_boolean_declarations.delete(declaration);
		}
		this.boolean_declarations.set(declaration, result);
		return result;
	}

	/** Responsibilities: _boolean declaration evaluation_. **/
	private boolean_declaration_result(
		declaration: ts.VariableDeclaration,
		name: string,
		source_file: ts.SourceFile,
	): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.name.text !== name) {
			return false;
		}
		if (declaration.type?.kind === ts.SyntaxKind.BooleanKeyword) {
			return true;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.boolean_expression(declaration.initializer, source_file);
	}

	/** Responsibilities: _boolean predicate naming_. **/
	private predicate_name(name: string): boolean {
		if (name.startsWith("is") || name.startsWith("has") || name.startsWith("can")) {
			return true;
		}
		if (name.startsWith("proxy_") || name.endsWith("_operator")) {
			return true;
		}
		if (name.startsWith("repeated_") || name.endsWith("_typeof")) {
			return true;
		}
		return ["some", "every", "includes", "startsWith", "endsWith", "test"].includes(name);
	}

	/** Responsibilities: _extraction invocation targets expression_. **/
	private call_targets(expression: ts.LeftHandSideExpression): BooleanCallTarget[] {
		if (ts.isIdentifier(expression)) {
			return [{ name: expression.text }];
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return [{ name: expression.name.text }];
		}
		return [];
	}

	/** Responsibilities: _boolean invocation declarations_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this.variable_bindings = new Map<ts.SourceFile, TypeScriptVariableBinding>();
		this.declaration_indexes = new WeakMap<ts.SourceFile, TypeScriptBooleanDeclarationIndex>();
		this.variable_declaration_index = variable_declaration_index;
		this.boolean_declarations = new WeakMap<ts.VariableDeclaration, boolean>();
		this.active_boolean_declarations = new WeakSet<ts.VariableDeclaration>();
	}
	/** Responsibilities: _public operation_. **/
	public boolean_call(node: ts.CallExpression, source_file: ts.SourceFile): boolean {
		const targets = this.call_targets(node.expression);
		for (const target of targets) {
			if (this.predicate_name(target.name)) {
				return true;
			}
			return this.declaration_index(source_file).boolean_callables.has(target.name);
		}
		return false;
	}

	/** Responsibilities: _boolean expression reporting_. **/
	public boolean_expression(node: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isParenthesizedExpression(node)) {
			return this.boolean_expression(node.expression, source_file);
		}
		if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
			return true;
		}
		if (ts.isPrefixUnaryExpression(node)) {
			return node.operator === ts.SyntaxKind.ExclamationToken;
		}
		return this.boolean_complex_expression(node, source_file);
	}

	/** Responsibilities: _reporting binary expression usage_. **/
	public logical_operator(node: ts.BinaryExpression): boolean {
		const kind = node.operatorToken.kind;
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return kind === ts.SyntaxKind.QuestionQuestionToken;
	}
}
