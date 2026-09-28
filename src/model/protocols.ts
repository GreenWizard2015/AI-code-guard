import ts from 'typescript';
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassNode,
	CallableOptions,
} from 'src/types';
import type {
	CallableNodeContext,
	DestructuredAlias,
	DestructuredInstanceOptions,
} from 'src/model/types';

/** Responsibilities: _define callable owner resolution_. **/
export interface CallOwnerResolver {
	call_owner(expression: ts.Expression, owner: string): string;
}

/** Responsibilities: _define TypeScript instance alias_. **/
export interface TypeScriptInstanceStore {
	add(name: string, owner: string, ...nodes: ts.Node[]): void;
	add_all(entries: readonly DestructuredAlias[], node: ts.Node): void;
	add_destructured(options: DestructuredInstanceOptions): void;
	instance_owner(name: string, node: ts.Node): string;
}

/** Responsibilities: _class callable node construction_. **/
export interface TypeScriptClassCallableNodesProtocol {
	interface_node(context: CallableNodeContext, node: ts.InterfaceDeclaration): AstClassNode;
	class_method_nodes(
		context: CallableNodeContext,
		node: ts.ClassLikeDeclaration,
		fallback_name: string
	): AstCallableNode[];
}

/** Responsibilities: _property ownership lookup_. **/
export interface TypeScriptPropertyStateProtocol {
	owner_for(owner: string, property: string): string;
	instance_owner(name: string, node: ts.Node): string;
	store_object_property(owner: string, property: string, property_owner: string): void;
	destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string
	): readonly DestructuredAlias[];
}

/** Responsibilities: _callable node construction_. **/
export interface TypeScriptCallableDataProtocol {
	callable_node(options: CallableOptions): AstCallableNode;
}

/** Responsibilities: _call reference collection_. **/
export interface TypeScriptCallReferenceCollectorProtocol {
	collect(): AstCallableReference[];
}
