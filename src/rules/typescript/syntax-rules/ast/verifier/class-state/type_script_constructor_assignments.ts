import { TypeScriptAstTypeShape } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_ast_type_shape";
import { TypeScriptConstructorParameters } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_constructor_parameters";
import type {
	TypeScriptClassFieldClassifierContract,
	TypeScriptClassFieldReadIndex,
	TypeScriptConstructorAssignmentsContract,
	TypeScriptConstructorParametersContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _constructor dependencies_, _field invariants_. **/
export class TypeScriptConstructorAssignments implements TypeScriptConstructorAssignmentsContract {
	private readonly _constructor: ts.ConstructorDeclaration;
	private readonly _fields: TypeScriptClassFieldReadIndex;
	private readonly _classifier: TypeScriptClassFieldClassifierContract;
	private readonly _parameters: TypeScriptConstructorParametersContract;
	private readonly _names: ReadonlySet<string>;

	/** Responsibilities: _constructor assignment index_. **/
	private assignment_nodes(): ts.BinaryExpression[] {
		const body = this._constructor.body;
		const pending: ts.Node[] = [];
		if (body !== undefined) {
			pending.push(body);
		}
		const assignments: ts.BinaryExpression[] = [];
		while (pending.length > 0) {
			this.visit_next_node(pending, assignments);
		}
		return assignments;
	}

	/** Responsibilities: _constructor AST traversal step_. **/
	private visit_next_node(pending: ts.Node[], assignments: ts.BinaryExpression[]): void {
		const current = pending.pop();
		if (current === undefined) {
			return;
		}
		if (ts.isBinaryExpression(current)) {
			assignments.push(current);
		}
		ts.forEachChild(current, (child) => {
			pending.push(child);
		});
	}

	/** Responsibilities: _constructor field assignment recognition_. **/
	private assigned_field(node: ts.BinaryExpression): string {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return "";
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return "";
		}
		if (node.left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return "";
		}
		if (!this.constructor_value(node.right)) {
			return "";
		}
		return node.left.name.text;
	}

	/** Responsibilities: _constructor value recognition_. **/
	private constructor_value(expression: ts.Expression): boolean {
		if (this.source_is_parameter(expression)) {
			return true;
		}
		if (ts.isNewExpression(expression)) {
			return true;
		}
		if (ts.isCallExpression(expression)) {
			return true;
		}
		return ts.isObjectLiteralExpression(expression);
	}

	/** Responsibilities: _parameter source recognition_. **/
	private source_is_parameter(expression: ts.Expression): boolean {
		let source = expression;
		while (ts.isPropertyAccessExpression(source)) {
			source = source.expression;
		}
		return ts.isIdentifier(source) && this._names.has(source.text);
	}

	/** Responsibilities: _dependency assignment classification_. **/
	private is_dependency_assignment(node: ts.BinaryExpression, field: string): boolean {
		const classification = this._classifier.field(field);
		if (this._fields.used_fields.has(field) && !classification.data) {
			return true;
		}
		if (this._fields.used_fields.has(field)) {
			const uses_parameter = this._parameters.uses_parameter(node.right, this._names);
			if (uses_parameter && !classification.scalar) {
				return true;
			}
		}
		if (classification.is_public) {
			if (!classification.data) {
				return true;
			}
			return classification.collection;
		}
		return false;
	}

	/** Responsibilities: _scalar field classification_. **/
	private scalar_behavior(field: string): boolean {
		const classification = this._classifier.field(field);
		if (!classification.scalar) {
			return false;
		}
		if (this._fields.decision_fields.has(field)) {
			return true;
		}
		return this._fields.error_context_fields.has(field);
	}

	/** Responsibilities: _parameter property state_. **/
	private retains_parameter_state(parameter: ts.ParameterDeclaration, field_name: string): boolean {
		if (parameter.type === undefined) {
			return false;
		}
		const shape = new TypeScriptAstTypeShape(parameter.type);
		if (shape.scalar_type()) {
			return false;
		}
		if (this._fields.used_fields.has(field_name)) {
			return true;
		}
		return this._classifier.field(field_name).is_public;
	}

	/** Responsibilities: _parameter property retention_. **/
	private retains_parameter_property(): boolean {
		for (const parameter of this._constructor.parameters) {
			if (!this._parameters.property_modifier(parameter)) {
				continue;
			}
			if (!ts.isIdentifier(parameter.name)) {
				continue;
			}
			const field_name = parameter.name.text;
			if (this.retains_parameter_state(parameter, field_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _constructor assignment initialization_. **/
	public constructor(
		constructor_node: ts.ConstructorDeclaration,
		fields: TypeScriptClassFieldReadIndex,
		classifier: TypeScriptClassFieldClassifierContract,
	) {
		this._constructor = constructor_node;
		this._fields = fields;
		this._classifier = classifier;
		this._parameters = new TypeScriptConstructorParameters(constructor_node);
		this._names = this._parameters.parameter_names();
	}

	/** Responsibilities: _constructor dependency retention_. **/
	public retains_dependency(): boolean {
		if (this.retains_parameter_property()) {
			return true;
		}
		for (const node of this.assignment_nodes()) {
			const field = this.assigned_field(node);
			if (field.length > 0 && this.is_dependency_assignment(node, field)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _field invariant retention_. **/
	public retains_value_invariant(): boolean {
		for (const node of this.assignment_nodes()) {
			const field = this.assigned_field(node);
			if (field.length === 0 || !this._fields.used_fields.has(field)) {
				continue;
			}
			if (this.scalar_behavior(field)) {
				return true;
			}
		}
		return false;
	}
}
