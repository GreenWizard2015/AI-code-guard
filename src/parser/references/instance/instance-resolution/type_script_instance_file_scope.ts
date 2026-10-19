import ts from "typescript";
import type { TypeScriptInstanceLookup } from "src/model/types";
import type { TypeScriptInstanceFileScopeContract } from "src/model/protocols";

/** Responsibilities: _lexical names_, _class scope_. **/
export class TypeScriptInstanceFileScope implements TypeScriptInstanceFileScopeContract {
	private readonly imported_binding_files: ReadonlyMap<string, string>;
	private readonly values: Map<string, { declaration: ts.Node; file: string; class_name: string }[]>;

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

	/** Responsibilities: _transparent initializer normalization_. **/
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

	/** Responsibilities: _instance initializer file resolution_. **/
	private initializer_file(initializer: ts.Expression): string {
		initializer = this.unwrapped_initializer(initializer);
		if (!ts.isNewExpression(initializer) && !ts.isCallExpression(initializer)) {
			return "";
		}
		const expression = initializer.expression;
		if (!ts.isIdentifier(expression)) {
			return "";
		}
		return this.imported_file(expression.text);
	}

	/** Responsibilities: _variable instance file resolution_. **/
	private variable_file(node: ts.VariableDeclaration): string {
		if (node.initializer === undefined) {
			return "";
		}
		return this.initializer_file(node.initializer);
	}

	/** Responsibilities: _parameter instance file resolution_. **/
	private parameter_file(node: ts.ParameterDeclaration): string {
		if (node.initializer === undefined) {
			return "";
		}
		return this.initializer_file(node.initializer);
	}

	/** Responsibilities: _binding source file resolution_. **/
	private resolved_file(node: ts.Node, inherited_file: string): string {
		if (inherited_file.length > 0) {
			return inherited_file;
		}
		if (ts.isVariableDeclaration(node)) {
			return this.variable_file(node);
		}
		if (ts.isParameter(node)) {
			return this.parameter_file(node);
		}
		if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
			const initializer = this.unwrapped_initializer(node.right);
			if (ts.isIdentifier(initializer)) {
				return this.file(initializer.text, node).value;
			}
			return this.initializer_file(initializer);
		}
		return "";
	}

	/** Responsibilities: _position-matched instance file_. **/
	private binding_file(
		bindings: readonly { declaration: ts.Node; file: string }[],
		reference: ts.Node,
	): TypeScriptInstanceLookup {
		const reference_start = reference.getStart(reference.getSourceFile());
		let file: TypeScriptInstanceLookup = { bound: false, value: "" };
		for (const binding of bindings) {
			const declaration_start = binding.declaration.getStart(binding.declaration.getSourceFile());
			if (declaration_start <= reference_start) {
				file = { bound: true, value: binding.file };
			}
		}
		return file;
	}

	/** Responsibilities: _instance declaration name_. **/
	private assignment_names(node: ts.Node): readonly string[] {
		if (!ts.isBinaryExpression(node)) {
			return [];
		}
		if (!ts.isIdentifier(node.left)) {
			return [];
		}
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return [];
		}
		return [node.left.text];
	}

	/** Responsibilities: _binding name recursion_. **/
	private append_binding_names(name: ts.BindingName, names: string[]): void {
		if (ts.isIdentifier(name)) {
			names.push(name.text);
			return;
		}
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				this.append_binding_names(element.name, names);
			}
		}
	}

	/** Responsibilities: _declaration instance names_. **/
	private variable_names(node: ts.VariableDeclaration): readonly string[] {
		const names: string[] = [];
		this.append_binding_names(node.name, names);
		return names;
	}

	/** Responsibilities: _parameter instance names_. **/
	private parameter_names(node: ts.ParameterDeclaration): readonly string[] {
		const names: string[] = [];
		this.append_binding_names(node.name, names);
		return names;
	}

	/** Responsibilities: _instance declaration name_. **/
	private binding_names(node: ts.Node): readonly string[] {
		const assignment_names = this.assignment_names(node);
		if (assignment_names.length > 0) {
			return assignment_names;
		}
		if (ts.isVariableDeclaration(node)) {
			return this.variable_names(node);
		}
		if (ts.isParameter(node)) {
			return this.parameter_names(node);
		}
		return [];
	}

	/** Responsibilities: _instance binding storage_. **/
	private append_binding(name: string, node: ts.Node, file: string, class_name: string): void {
		let bindings = this.values.get(name);
		if (bindings === undefined) {
			bindings = [];
			this.values.set(name, bindings);
		}
		bindings.push({ declaration: node, file, class_name });
	}

	/** Responsibilities: _assignment class identity_. **/
	private assignment_class_name(node: ts.BinaryExpression): string {
		if (!ts.isIdentifier(node.left)) {
			return "";
		}
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return "";
		}
		const initializer = this.unwrapped_initializer(node.right);
		if (ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression)) {
			return initializer.expression.text;
		}
		if (ts.isIdentifier(initializer)) {
			return this.class_name(initializer.text, node).value;
		}
		return "";
	}

	/** Responsibilities: _scope file storage initialization_. **/
	public constructor(imported_binding_files: ReadonlyMap<string, string>) {
		this.imported_binding_files = imported_binding_files;
		this.values = new Map<string, { declaration: ts.Node; file: string; class_name: string }[]>();
	}

	/** Responsibilities: _scope local instance discovery_. **/
	public append(node: ts.Node, inherited_file: string, class_name: string = ""): void {
		const names = this.binding_names(node);
		if (names.length === 0) {
			return;
		}
		const file = this.resolved_file(node, inherited_file);
		let resolved_class_name = class_name;
		if (ts.isBinaryExpression(node)) {
			const assignment_class_name = this.assignment_class_name(node);
			if (assignment_class_name.length > 0) {
				resolved_class_name = assignment_class_name;
			}
		}
		for (const name of names) this.append_binding(name, node, file, resolved_class_name);
	}

	/** Responsibilities: _scope file lookup_. **/
	public file(name: string, reference: ts.Node): TypeScriptInstanceLookup {
		const bindings = this.values.get(name);
		if (bindings === undefined) {
			return { bound: false, value: "" };
		}
		return this.binding_file(bindings, reference);
	}

	/** Responsibilities: _scope instance class lookup_. **/
	public class_name(name: string, reference: ts.Node): TypeScriptInstanceLookup {
		const bindings = this.values.get(name);
		if (bindings === undefined) {
			return { bound: false, value: "" };
		}
		const reference_start = reference.getStart(reference.getSourceFile());
		let class_name: TypeScriptInstanceLookup = { bound: false, value: "" };
		for (const binding of bindings) {
			if (binding.declaration.getStart(binding.declaration.getSourceFile()) <= reference_start) {
				class_name = { bound: true, value: binding.class_name };
			}
		}
		return class_name;
	}
}
