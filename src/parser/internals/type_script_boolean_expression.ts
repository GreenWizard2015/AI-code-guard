import { TypeScriptVariableBinding } from "src/linting/type_script_variable_binding";
import type { BooleanCallTarget } from "src/model_types";
import { BOOLEAN_OPERATOR_KINDS, COMPARISON_OPERATOR_KINDS } from "src/parser/internals/constants";
import { TypeScriptBooleanDeclarationIndex } from "src/parser/internals/type_script_boolean_declaration_index";
import type { BooleanExpressionContract } from "src/runtime_protocols";
import type {
	TypeScriptBooleanDeclarationIndexContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _boolean declaration resolution_, _boolean expression classification_. **/
export class TypeScriptBooleanExpression implements BooleanExpressionContract {
	private readonly _variable_bindings: Map<ts.SourceFile, TypeScriptVariableBinding>;
	private readonly _declaration_indexes: WeakMap<ts.SourceFile, TypeScriptBooleanDeclarationIndexContract>;
	private readonly _variable_declaration_index: TypeScriptVariableDeclarationIndexContract;
	private readonly _boolean_declarations: WeakMap<ts.VariableDeclaration, boolean>;
	private readonly _active_boolean_declarations: WeakSet<ts.VariableDeclaration>;
	private readonly _comparison_operator_kinds: readonly ts.SyntaxKind[];
	private readonly _boolean_operator_kinds: readonly ts.SyntaxKind[];

	/** Responsibilities: _source-file boolean declaration index_. **/
	private declaration_index(index_source: ts.SourceFile): TypeScriptBooleanDeclarationIndexContract {
		const cached = this._declaration_indexes.get(index_source);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptBooleanDeclarationIndex();
		index.append(index_source);
		this._declaration_indexes.set(index_source, index);
		return index;
	}

	/** Responsibilities: _classification complex expression resolution_. **/
	private boolean_complex_expression(node: ts.Expression, complex_source: ts.SourceFile): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.boolean_binary_expression(node, complex_source);
		}
		if (ts.isIdentifier(node)) {
			return this.boolean_binding(node.text, complex_source, node);
		}
		if (ts.isPropertyAccessExpression(node)) {
			return this.declaration_index(complex_source).boolean_properties().has(node.name.text);
		}
		if (ts.isCallExpression(node)) {
			return this.boolean_call(node, complex_source);
		}
		return false;
	}

	/** Responsibilities: _classification binary expression boolean_. **/
	private boolean_binary_expression(node: ts.BinaryExpression, binary_source: ts.SourceFile): boolean {
		if (this._comparison_operator_kinds.includes(node.operatorToken.kind)) {
			return true;
		}
		if (!this._boolean_operator_kinds.includes(node.operatorToken.kind)) {
			return false;
		}
		if (!this.boolean_expression(node.left, binary_source)) {
			return false;
		}
		return this.boolean_expression(node.right, binary_source);
	}

	/** Responsibilities: _classification binding resolution boolean_. **/
	private boolean_binding(binding_name: string, binding_source: ts.SourceFile, reference: ts.Node): boolean {
		let bindings = this._variable_bindings.get(binding_source);
		if (bindings === undefined) {
			bindings = new TypeScriptVariableBinding(binding_source, this._variable_declaration_index);
			this._variable_bindings.set(binding_source, bindings);
		}
		const declaration = bindings.declaration(binding_name, reference);
		if (!ts.isVariableDeclaration(declaration)) {
			return false;
		}
		return this.boolean_declaration(declaration, binding_name, binding_source);
	}

	/** Responsibilities: _classification declaration establishes boolean_. **/
	private boolean_declaration(
		declaration: ts.VariableDeclaration,
		declaration_name: string,
		declaration_source: ts.SourceFile,
	): boolean {
		const cached = this._boolean_declarations.get(declaration);
		if (cached !== undefined) {
			return cached;
		}
		if (this._active_boolean_declarations.has(declaration)) {
			return false;
		}
		this._active_boolean_declarations.add(declaration);
		let result = false;
		try {
			result = this.boolean_declaration_result(declaration, declaration_name, declaration_source);
		} finally {
			this._active_boolean_declarations.delete(declaration);
		}
		this._boolean_declarations.set(declaration, result);
		return result;
	}

	/** Responsibilities: _boolean declaration evaluation_. **/
	private boolean_declaration_result(
		declaration: ts.VariableDeclaration,
		result_name: string,
		result_source: ts.SourceFile,
	): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.name.text !== result_name) {
			return false;
		}
		const type = declaration.type;
		if (type !== undefined) {
			if (type.kind === ts.SyntaxKind.BooleanKeyword) {
				return true;
			}
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.boolean_expression(declaration.initializer, result_source);
	}

	/** Responsibilities: _boolean predicate naming_. **/
	private predicate_name(candidate_name: string): boolean {
		if (candidate_name.startsWith("is") || candidate_name.startsWith("has") || candidate_name.startsWith("can")) {
			return true;
		}
		return ["some", "every", "includes", "startsWith", "endsWith", "test"].includes(candidate_name);
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
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this._variable_bindings = new Map<ts.SourceFile, TypeScriptVariableBinding>();
		this._declaration_indexes = new WeakMap<ts.SourceFile, TypeScriptBooleanDeclarationIndex>();
		this._variable_declaration_index = variable_declaration_index;
		this._boolean_declarations = new WeakMap<ts.VariableDeclaration, boolean>();
		this._active_boolean_declarations = new WeakSet<ts.VariableDeclaration>();
		this._comparison_operator_kinds = COMPARISON_OPERATOR_KINDS;
		this._boolean_operator_kinds = BOOLEAN_OPERATOR_KINDS;
	}
	/** Responsibilities: _public operation_. **/
	public boolean_call(node: ts.CallExpression, call_source: ts.SourceFile): boolean {
		const targets = this.call_targets(node.expression);
		for (const target of targets) {
			if (this.predicate_name(target.name)) {
				return true;
			}
			return this.declaration_index(call_source).boolean_callables().has(target.name);
		}
		return false;
	}

	/** Responsibilities: _boolean expression reporting_. **/
	public boolean_expression(node: ts.Expression, expression_source: ts.SourceFile): boolean {
		if (ts.isParenthesizedExpression(node)) {
			return this.boolean_expression(node.expression, expression_source);
		}
		if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
			return true;
		}
		if (ts.isPrefixUnaryExpression(node)) {
			return node.operator === ts.SyntaxKind.ExclamationToken;
		}
		return this.boolean_complex_expression(node, expression_source);
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
