import type {
	AstArgumentUse,
	AstClassField,
	AstStatementNode,
	AstTypedArgument,
} from 'src/types';
import type { FixtureCallableNode, FixtureClassNode } from 'tests/core/types';

/** Responsibilities: _callable fixture collection_, _class fixture collection_. **/
export class FixtureLists {
	public readonly statements: AstStatementNode[] = [];
	public readonly parameter_types: string[] = [];
	public readonly untyped_parameters: string[] = [];
	public readonly argument_uses: AstArgumentUse[] = [];
	public readonly typed_arguments: AstTypedArgument[] = [];
	public readonly decorators: string[] = [];
	public readonly methods: FixtureCallableNode[] = [];
	public readonly interfaces: string[] = [];
	public readonly base_class_names: string[] = [];
	public readonly fields: Array<Partial<AstClassField>> = [];
	public readonly dependencies: string[] = [];

	/** Responsibilities: _callable fixture initialization_. **/
	public constructor(callable: FixtureCallableNode) {
		if (callable.statements !== undefined) {
			this.statements.push(...callable.statements);
		}
		if (callable.parameter_types !== undefined) {
			this.parameter_types.push(...callable.parameter_types);
		}
		if (callable.untyped_parameters !== undefined) {
			this.untyped_parameters.push(...callable.untyped_parameters);
		}
		if (callable.argument_uses !== undefined) {
			this.argument_uses.push(...callable.argument_uses);
		}
		if (callable.typed_arguments !== undefined) {
			this.typed_arguments.push(...callable.typed_arguments);
		}
		if (callable.decorators !== undefined) {
			this.decorators.push(...callable.decorators);
		}
	}

	/** Responsibilities: _class fixture aggregation_. **/
	public constructor_lists(class_node: FixtureClassNode): void {
		if (class_node.methods !== undefined) {
			this.methods.push(...class_node.methods);
		}
		if (class_node.interfaces !== undefined) {
			this.interfaces.push(...class_node.interfaces);
		}
		if (class_node.base_class_names !== undefined) {
			this.base_class_names.push(...class_node.base_class_names);
		}
		if (class_node.fields !== undefined) {
			this.fields.push(...class_node.fields);
		}
		if (class_node.dependencies !== undefined) {
			this.dependencies.push(...class_node.dependencies);
		}
	}
}
