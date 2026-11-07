import type { TypeScriptInstanceFileScopeContract } from "src/model/protocols";
import type { TypeScriptInstanceLookup } from "src/model/types";
import { TypeScriptInstanceBindingNames } from "src/parser/references/instance/instance-resolution/type_script_instance_binding_names";
import ts from "typescript";

/** Responsibilities: _lexical names_, _class scope_. **/
export class TypeScriptInstanceFileScope implements TypeScriptInstanceFileScopeContract {
	private readonly _imported_binding_files: ReadonlyMap<string, string>;
	private readonly _values: Map<string, { declaration: ts.Node; file: string; class_name: string }[]>;
	private readonly _declaration_names: TypeScriptInstanceBindingNames;

	/** Responsibilities: _imported instance file lookup_. **/
	private imported_file(imported_name: string): string {
		const file = this._imported_binding_files.get(imported_name);
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

	/** Responsibilities: _transparent initializer normalization_. **/
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

	/** Responsibilities: _instance initializer file resolution_. **/
	private initializer_file(initializer: ts.Expression): string {
		const normalized_initializer = this.unwrapped_initializer(initializer);
		if (!ts.isNewExpression(normalized_initializer) && !ts.isCallExpression(normalized_initializer)) {
			return "";
		}
		const expression = normalized_initializer.expression;
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
	private resolved_file(binding_node: ts.Node, inherited_file: string): string {
		if (inherited_file.length > 0) {
			return inherited_file;
		}
		if (ts.isVariableDeclaration(binding_node)) {
			return this.variable_file(binding_node);
		}
		if (ts.isParameter(binding_node)) {
			return this.parameter_file(binding_node);
		}
		if (ts.isBinaryExpression(binding_node) && ts.isIdentifier(binding_node.left)) {
			const initializer = this.unwrapped_initializer(binding_node.right);
			if (ts.isIdentifier(initializer)) {
				return this.file(initializer.text, binding_node).value;
			}
			return this.initializer_file(initializer);
		}
		return "";
	}

	/** Responsibilities: _position-matched instance file_. **/
	private binding_file(
		bindings: readonly { declaration: ts.Node; file: string }[],
		binding_reference: ts.Node,
	): TypeScriptInstanceLookup {
		const reference_start = binding_reference.getStart(binding_reference.getSourceFile());
		let file: TypeScriptInstanceLookup = { bound: false, value: "" };
		for (const binding of bindings) {
			const declaration_start = binding.declaration.getStart(binding.declaration.getSourceFile());
			if (declaration_start <= reference_start) {
				file = { bound: true, value: binding.file };
			}
		}
		return file;
	}

	/** Responsibilities: _instance binding storage_. **/
	private append_binding(binding_name: string, declaration_node: ts.Node, file: string, class_name: string): void {
		let bindings = this._values.get(binding_name);
		if (bindings === undefined) {
			bindings = [];
			this._values.set(binding_name, bindings);
		}
		bindings.push({ declaration: declaration_node, file, class_name });
	}

	/** Responsibilities: _assignment class identity_. **/
	private assignment_class_name(assignment: ts.BinaryExpression): string {
		if (this._declaration_names.assignment_target(assignment).length === 0) {
			return "";
		}
		const initializer = this.unwrapped_initializer(assignment.right);
		if (ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression)) {
			return initializer.expression.text;
		}
		if (ts.isIdentifier(initializer)) {
			return this.class_name(initializer.text, assignment).value;
		}
		return "";
	}

	/** Responsibilities: _scope file storage initialization_. **/
	public constructor(imported_binding_files: ReadonlyMap<string, string>) {
		this._imported_binding_files = imported_binding_files;
		this._values = new Map<string, { declaration: ts.Node; file: string; class_name: string }[]>();
		this._declaration_names = new TypeScriptInstanceBindingNames();
	}

	/** Responsibilities: _scope local instance discovery_. **/
	public append(scope_node: ts.Node, inherited_file: string, class_name = ""): void {
		const names = this._declaration_names.names(scope_node);
		if (names.length === 0) {
			return;
		}
		const file = this.resolved_file(scope_node, inherited_file);
		let resolved_class_name = class_name;
		if (ts.isBinaryExpression(scope_node)) {
			const assignment_class_name = this.assignment_class_name(scope_node);
			if (assignment_class_name.length > 0) {
				resolved_class_name = assignment_class_name;
			}
		}
		for (const name of names) {
			this.append_binding(name, scope_node, file, resolved_class_name);
		}
	}

	/** Responsibilities: _scope file lookup_. **/
	public file(instance_name: string, file_reference: ts.Node): TypeScriptInstanceLookup {
		const bindings = this._values.get(instance_name);
		if (bindings === undefined) {
			return { bound: false, value: "" };
		}
		return this.binding_file(bindings, file_reference);
	}

	/** Responsibilities: _scope instance class lookup_. **/
	public class_name(class_lookup_name: string, class_reference: ts.Node): TypeScriptInstanceLookup {
		const bindings = this._values.get(class_lookup_name);
		if (bindings === undefined) {
			return { bound: false, value: "" };
		}
		const reference_start = class_reference.getStart(class_reference.getSourceFile());
		let class_name: TypeScriptInstanceLookup = { bound: false, value: "" };
		for (const binding of bindings) {
			if (binding.declaration.getStart(binding.declaration.getSourceFile()) <= reference_start) {
				class_name = { bound: true, value: binding.class_name };
			}
		}
		return class_name;
	}
}
