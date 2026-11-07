import type { ConstructorLocalValues } from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptConstructorParametersContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _constructor parameter aliases_, _parameter property classification_. **/
export class TypeScriptConstructorParameters implements TypeScriptConstructorParametersContract {
	private readonly _constructor: ts.ConstructorDeclaration;
	private readonly _parameter_names: Set<string>;

	/** Responsibilities: _single constructor node collection_. **/
	private append_local_value(node: ts.Node, values: ConstructorLocalValues): void {
		if (ts.isVariableDeclaration(node)) {
			values.declarations.push(node);
		}
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			values.assignments.push(node);
		}
	}

	/** Responsibilities: _constructor local value collection_. **/
	private local_values(): ConstructorLocalValues {
		const values: ConstructorLocalValues = { declarations: [], assignments: [] };
		const body = this._constructor.body;
		if (body === undefined) {
			return values;
		}
		const pending: ts.Node[] = [body];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined || ts.isFunctionLike(node) || ts.isClassLike(node)) {
				continue;
			}
			this.append_local_value(node, values);
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
		return values;
	}

	/** Responsibilities: _transitive parameter alias expansion_. **/
	private expand_aliases(values: ConstructorLocalValues): void {
		let found_alias = true;
		while (found_alias) {
			found_alias = false;
			for (const declaration of values.declarations) {
				found_alias = this.add_alias(declaration) || found_alias;
			}
			for (const assignment of values.assignments) {
				found_alias = this.add_assignment_alias(assignment) || found_alias;
			}
		}
	}

	/** Responsibilities: _assigned alias recognition_. **/
	private add_assignment_alias(assignment: ts.BinaryExpression): boolean {
		if (!ts.isIdentifier(assignment.left) || this._parameter_names.has(assignment.left.text)) {
			return false;
		}
		if (!this.uses_parameter(assignment.right, this._parameter_names)) {
			return false;
		}
		this._parameter_names.add(assignment.left.text);
		return true;
	}

	/** Responsibilities: _declared alias recognition_. **/
	private add_alias(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		if (this._parameter_names.has(declaration.name.text)) {
			return false;
		}
		if (!this.uses_parameter(declaration.initializer, this._parameter_names)) {
			return false;
		}
		this._parameter_names.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _identifier role classification_. **/
	private value_reference(node: ts.Identifier): boolean {
		const parent = node.parent;
		if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
			return false;
		}
		if (ts.isPropertyAssignment(parent) && parent.name === node) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _parameter property modifier recognition_. **/
	private parameter_modifier_kind(kind: ts.SyntaxKind): boolean {
		switch (kind) {
			case ts.SyntaxKind.PublicKeyword:
			case ts.SyntaxKind.PrivateKeyword:
			case ts.SyntaxKind.ProtectedKeyword:
			case ts.SyntaxKind.ReadonlyKeyword:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _constructor parameter analysis state_. **/
	public constructor(constructor_node: ts.ConstructorDeclaration) {
		this._constructor = constructor_node;
		this._parameter_names = new Set<string>();
	}

	/** Responsibilities: _parameter alias names_. **/
	public parameter_names(): Set<string> {
		this._parameter_names.clear();
		for (const parameter of this._constructor.parameters) {
			if (ts.isIdentifier(parameter.name)) {
				this._parameter_names.add(parameter.name.text);
			}
		}
		this.expand_aliases(this.local_values());
		return new Set(this._parameter_names);
	}

	/** Responsibilities: _parameter property detection_. **/
	public property_modifier(parameter: ts.ParameterDeclaration): boolean {
		if (!ts.canHaveModifiers(parameter)) {
			return false;
		}
		const modifiers = ts.getModifiers(parameter);
		return modifiers?.some((modifier) => this.parameter_modifier_kind(modifier.kind)) ?? false;
	}

	/** Responsibilities: _constructor input reference detection_. **/
	public uses_parameter(expression: ts.Expression, names: ReadonlySet<string>): boolean {
		const pending: ts.Node[] = [expression];
		while (pending.length > 0) {
			const node = pending.pop();
			if (node === undefined || ts.isClassLike(node) || ts.isFunctionLike(node)) {
				continue;
			}
			if (ts.isIdentifier(node) && this.value_reference(node) && names.has(node.text)) {
				return true;
			}
			ts.forEachChild(node, (child) => {
				pending.push(child);
			});
		}
		return false;
	}
}
