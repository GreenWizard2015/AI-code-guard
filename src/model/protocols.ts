import type {
	AstCallableNode,
	AstCallableReference,
	AstClassNode,
	AstImportIssue,
	CallableReferenceIdentity,
	CallableReferenceKind,
} from "src/model/ast/normalized_ast_types";
import type { CallableTypeData, DestructuredAlias, DestructuredInstanceOptions, TypedArgument } from "src/model/types";
import type { TypeScriptReferenceQueryKind } from "src/model/types";
import type { TypeScriptInstanceLookup } from "src/model/types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { AstCallableReferenceRecord } from "src/source_types";
import type { CallableOptions, TypeScriptPropertyAddress, TypeScriptPropertySide } from "src/types";
import type { CallbackKind } from "src/types";
import type { RuleParameters } from "src/types";
import type ts from "typescript";

/** Responsibilities: _diagnostic rule behavior_. **/
export interface DiagnosticRuleContract extends RuleContract {
	violation(file: string, line: number, parameters: RuleParameters): ViolationContract;
}

/** Responsibilities: _reference ownership query_. **/
export type TypeScriptReferenceQuery = {
	readonly kind: TypeScriptReferenceQueryKind;
	readonly expression: ts.Expression;
	readonly owner: string;
};

/** Responsibilities: _callable reference metadata_, _reference ownership_. **/
export interface TypeScriptReferenceResolutionContract {
	owner(): string;
	identity(): CallableReferenceIdentity;
	callable_reference(kind: CallableReferenceKind, line: number): AstCallableReference;
}

/** Responsibilities: _AST node import issues_. **/
export interface TypeScriptNodeImportIssuesContract {
	node_import_issues(node: ts.Node, line: number): AstImportIssue[];
}

/** Responsibilities: _callable reference collection_. **/
export interface CallableReferenceCollectionContract {
	append(reference: AstCallableReferenceRecord): void;
	length(): number;
	since(index: number): AstCallableReferenceRecord[];
}

/** Responsibilities: _class callable collection_. **/
export type ClassCallableNodeCollection = {
	readonly owner: string;
	readonly callables: AstCallableNode[];
};

/** Responsibilities: _callable owner resolution_. **/
export interface CallOwnerResolverContract {
	resolve_reference(query: TypeScriptReferenceQuery): TypeScriptReferenceResolutionContract;
}

/** Responsibilities: _TypeScript instance storage_. **/
export interface TypeScriptInstanceStoreContract {
	add(name: string, owner: string, ...nodes: ts.Node[]): void;
	add_all(entries: readonly DestructuredAlias[], node: ts.Node): void;
	add_destructured(options: DestructuredInstanceOptions): void;
	instance_owner(name: string, node: ts.Node): TypeScriptInstanceLookup;
}

/** Responsibilities: _instance scope registration_, _instance file lookup_, _instance class lookup_. **/
export interface TypeScriptInstanceFileScopeContract {
	append(node: ts.Node, inherited_file: string, class_name: string): void;
	file(name: string, reference: ts.Node): TypeScriptInstanceLookup;
	class_name(name: string, reference: ts.Node): TypeScriptInstanceLookup;
}

/** Responsibilities: _lexical scope resolution_. **/
export interface TypeScriptLexicalScopeContract {
	declaration_scope(node: ts.Node): ts.Node;
	assignment_scope(node: ts.Node): ts.Node;
	scope_chain(node: ts.Node): readonly ts.Node[];
}

/** Responsibilities: _property instance ownership_. **/
export type TypeScriptInstanceOwner = {
	readonly owner_file: string;
	readonly owner_class: string;
};

/** Responsibilities: _property instance file resolution_. **/
export interface TypeScriptPropertyInstanceFilesContract {
	collect(node: ts.Node, owner_file: string, owner_class: string): void;
	file(owner_file: string, owner_class: string, name: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _instance file resolution_, _instance class resolution_. **/
export interface TypeScriptInstanceFilesContract {
	collect(tree_node: ts.Node, tree_owner: TypeScriptInstanceOwner, local_class_names: Set<string>): void;
	instance_file(name: string, node: ts.Node): string;
	instance_class(name: string, node: ts.Node): string;
}

/** Responsibilities: _reference file indexing_, _reference file resolution_. **/
export interface TypeScriptReferenceFileIndexContract {
	index_source_file(source_file: ts.SourceFile): void;
	imported_class_file(owner: string): string;
	local_class_file(owner: string): string;
	new_receiver_file(expression: ts.NewExpression): string;
}

/** Responsibilities: _class callable node construction_. **/
export interface TypeScriptClassCallableNodesContract {
	interface_node(node: ts.InterfaceDeclaration): AstClassNode;
	class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNode[];
	variable_callable_nodes(statement: ts.VariableStatement): AstCallableNode[];
}

/** Responsibilities: _property ownership context_. **/
export type TypeScriptPropertyContext = {
	readonly owner: string;
	readonly side: TypeScriptPropertySide;
};

/** Responsibilities: _property state collection_, _property ownership lookup_. **/
export interface TypeScriptPropertyStateContract {
	append_tree(node: ts.Node): void;
	property_owner(address: TypeScriptPropertyAddress): string;
	store_object_property(address: TypeScriptPropertyAddress, property_owner: string): void;
	destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string,
	): readonly DestructuredAlias[];
}

/** Responsibilities: _destructured instance alias context_. **/
export type TypeScriptDestructuredOwnerContext = {
	readonly initializer: ts.Expression;
	readonly current_owner: string;
	readonly pattern: ts.ObjectBindingPattern;
};

/** Responsibilities: _destructured alias collection_. **/
export interface TypeScriptDestructuredAliasCollectorContract {
	collect_element(
		element: ts.BindingElement,
		object_owner: string,
		source_file: ts.SourceFile,
	): readonly DestructuredAlias[];
	collect(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string,
	): readonly DestructuredAlias[];
}

/** Responsibilities: _call return initialization_, _call owner lookup_. **/
export interface TypeScriptCallReturnsContract {
	initialize(): void;
	owner_for(name: string, owner: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _property reference identity_. **/
export type TypeScriptPropertyReference = {
	readonly owner_file: string;
	readonly owner_class: string;
	readonly name: string;
	readonly side: TypeScriptPropertySide;
};

/** Responsibilities: _TypeScript reference identity resolution_. **/
export interface TypeScriptReferenceIdentityContract {
	member_name(expression: ts.AccessExpression): string;
	class_receiver(name: string): boolean;
	method_reference(expression: ts.AccessExpression, owner: string): CallableReferenceIdentity;
}

/** Responsibilities: _TypeScript instance alias collection_. **/
export interface TypeScriptInstanceAliasCollectorContract {
	collect_bindings(): void;
}

/** Responsibilities: _callable node construction_. **/
export interface TypeScriptCallableDataContract {
	callable_node(options: CallableOptions): AstCallableNode;
}

/** Responsibilities: _callable parameter data_, _callable type data_. **/
export interface CallableParameterDataContract {
	typed_arguments(node: ts.SignatureDeclarationBase): TypedArgument[];
	type_data(node: ts.SignatureDeclarationBase): CallableTypeData;
}

/** Responsibilities: _callback kind resolution_. **/
export interface TypeScriptCallbackAliasesContract {
	kind(): CallbackKind;
}

/** Responsibilities: _call reference collection_. **/
export interface TypeScriptCallReferenceCollectorContract {
	collect(): AstCallableReference[];
	references(): AstCallableReference[];
	append_reference(node: ts.Node, owner: string): void;
}
