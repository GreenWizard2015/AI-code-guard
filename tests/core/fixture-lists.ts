import type { AstArgumentUse, AstStatementNode, AstTypedArgument } from "src/model/ast/normalized_ast_types";
import type { FixtureCallableNode, FixtureClassNode } from "tests/core/types";
import type { AstClassFieldPatch } from "tests/core/types";

/** Responsibilities: _callable fixture collection_, _class fixture collection_. **/
export class FixtureLists {
	public readonly _statements: AstStatementNode[];
	public readonly _parameter_types: string[];
	public readonly _untyped_parameters: string[];
	public readonly _argument_uses: AstArgumentUse[];
	public readonly _typed_arguments: AstTypedArgument[];
	public readonly _decorators: string[];
	public readonly _methods: FixtureCallableNode[];
	public readonly _interfaces: string[];
	public readonly _base_class_names: string[];
	public readonly _fields: AstClassFieldPatch[];
	public readonly _dependencies: string[];

	/** Responsibilities: _callable fixture initialization_. **/
	public constructor(callable: FixtureCallableNode) {
		this._statements = [];
		this._parameter_types = [];
		this._untyped_parameters = [];
		this._argument_uses = [];
		this._typed_arguments = [];
		this._decorators = [];
		this._methods = [];
		this._interfaces = [];
		this._base_class_names = [];
		this._fields = [];
		this._dependencies = [];
		if (callable.statements !== undefined) {
			this._statements.push(...callable.statements);
		}
		if (callable.parameter_types !== undefined) {
			this._parameter_types.push(...callable.parameter_types);
		}
		if (callable.untyped_parameters !== undefined) {
			this._untyped_parameters.push(...callable.untyped_parameters);
		}
		if (callable.argument_uses !== undefined) {
			this._argument_uses.push(...callable.argument_uses);
		}
		if (callable.typed_arguments !== undefined) {
			this._typed_arguments.push(...callable.typed_arguments);
		}
		if (callable.decorators !== undefined) {
			this._decorators.push(...callable.decorators);
		}
	}

	/** Responsibilities: _class fixture aggregation_. **/
	public constructor_lists(class_node: FixtureClassNode): void {
		if (class_node.methods !== undefined) {
			this._methods.push(...class_node.methods);
		}
		if (class_node.interfaces !== undefined) {
			this._interfaces.push(...class_node.interfaces);
		}
		if (class_node.base_class_names !== undefined) {
			this._base_class_names.push(...class_node.base_class_names);
		}
		if (class_node.fields !== undefined) {
			this._fields.push(...class_node.fields);
		}
		if (class_node.dependencies !== undefined) {
			this._dependencies.push(...class_node.dependencies);
		}
	}
}
