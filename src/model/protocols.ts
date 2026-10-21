import ts from "typescript";
import type {
	AstCallableNodeContract,
	AstCallableReference,
	AstClassNodeContract,
	CallableOptions,
	CallableReferenceIdentity,
	TypeScriptPropertySide,
} from "src/types";
import type { CallableTypeData, DestructuredAlias, DestructuredInstanceOptions, TypedArgument } from "src/model/types";
import type { CallbackKind } from "src/types";
import type { AstCallableReferenceContract } from "src/source_types";
import type { TypeScriptInstanceLookup } from "src/model/types";

/** Responsibilities: _callable reference collection_. **/
export interface CallableReferenceCollectionContract {
	append(reference: AstCallableReferenceContract): void;
	length(): number;
	since(index: number): AstCallableReferenceContract[];
}

/** Responsibilities: _define callable owner resolution_. **/
export interface CallOwnerResolverContract {
	call_owner(expression: ts.Expression, owner: string): string;
}

/** Responsibilities: _define TypeScript instance alias_. **/
export interface TypeScriptInstanceStoreContract {
	add(name: string, owner: string, ...nodes: ts.Node[]): void;
	add_all(entries: readonly DestructuredAlias[], node: ts.Node): void;
	add_destructured(options: DestructuredInstanceOptions): void;
	instance_owner(name: string, node: ts.Node): TypeScriptInstanceLookup;
}

/** Responsibilities: _TypeScript instance scope contract_. **/
export interface TypeScriptInstanceFileScopeContract {
	append(node: ts.Node, inherited_file: string, class_name: string): void;
	file(name: string, reference: ts.Node): TypeScriptInstanceLookup;
	class_name(name: string, reference: ts.Node): TypeScriptInstanceLookup;
}

/** Responsibilities: _TypeScript lexical scope contract_. **/
export interface TypeScriptLexicalScopeContract {
	declaration_scope(node: ts.Node): ts.Node;
	assignment_scope(node: ts.Node): ts.Node;
	scope_chain(node: ts.Node): readonly ts.Node[];
}

/** Responsibilities: _property instance files_. **/
export interface TypeScriptPropertyInstanceFilesContract {
	collect(node: ts.Node, owner_file: string, owner_class: string): void;
	file(owner_file: string, owner_class: string, name: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _TypeScript instance file contract_. **/
export interface TypeScriptInstanceFilesContract {
	collect(source_file: ts.SourceFile): void;
	instance_file(name: string, node: ts.Node): string;
	instance_class(name: string, node: ts.Node): string;
}

/** Responsibilities: _reference file indexing_. **/
export interface TypeScriptReferenceFileIndexContract {
	index_source_file(source_file: ts.SourceFile): void;
	imported_class_file(owner: string): string;
	local_class_file(owner: string): string;
	new_receiver_file(expression: ts.NewExpression): string;
}

/** Responsibilities: _class callable node construction_. **/
export interface TypeScriptClassCallableNodesContract {
	interface_node(node: ts.InterfaceDeclaration): AstClassNodeContract;
	class_method_nodes(node: ts.ClassLikeDeclaration, fallback_name: string): AstCallableNodeContract[];
	variable_callable_nodes(statement: ts.VariableStatement): AstCallableNodeContract[];
}

/** Responsibilities: _property ownership lookup_. **/
export interface TypeScriptPropertyStateContract {
	append_tree(node: ts.Node, owner: string): void;
	property_owner(owner: string, property: string, side: TypeScriptPropertySide): string;
	store_object_property(owner: string, property: string, property_owner: string): void;
	destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner: string,
	): readonly DestructuredAlias[];
}

/** Responsibilities: _TypeScript destructured alias collection_. **/
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

/** Responsibilities: _invocation results_. **/
export interface TypeScriptCallReturnsContract {
	initialize(): void;
	owner_for(name: string, owner: string, side: TypeScriptPropertySide): string;
}

/** Responsibilities: _TypeScript reference identity resolution_. **/
export interface TypeScriptReferenceIdentityContract {
	member_name(expression: ts.AccessExpression): string;
	class_receiver(name: string): boolean;
	method_reference(expression: ts.AccessExpression, owner: string): CallableReferenceIdentity;
}

/** Responsibilities: _TypeScript instance alias collection_. **/
export interface TypeScriptInstanceAliasCollectorContract {
	collect_variables(): void;
	collect_parameters(): void;
	collect_bindings(): void;
}

/** Responsibilities: _callable node construction_. **/
export interface TypeScriptCallableDataContract {
	callable_node(options: CallableOptions): AstCallableNodeContract;
}

/** Responsibilities: _TypeScript callable parameter data_. **/
export interface CallableParameterDataContract {
	typed_arguments(node: ts.SignatureDeclarationBase): TypedArgument[];
	type_data(node: ts.SignatureDeclarationBase): CallableTypeData;
}

/** Responsibilities: _TypeScript argument usage collection_. **/
export interface TypeScriptArgumentUsageContract {
	collect_argument_usage(node: ts.SignatureDeclarationBase): { name: string; count: number }[];
}

/** Responsibilities: _TypeScript callback aliases_. **/
export interface TypeScriptCallbackAliasesContract {
	kind(name: string): CallbackKind;
}

/** Responsibilities: _reference contract_. **/
export interface TypeScriptCallReferenceCollectorContract {
	collect(): AstCallableReference[];
	append_reference(node: ts.Node, references: AstCallableReference[], owner: string): void;
}
