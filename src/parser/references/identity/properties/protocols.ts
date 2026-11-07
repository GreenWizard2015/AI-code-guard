import type { CallOwnerResolverContract, TypeScriptPropertyContext } from "src/model/protocols";
import type { DeclarationPredicatesContract } from "src/parser/analysis/protocols";
import type { TypeScriptPropertySide } from "src/types";
import type { TypeScriptReferenceBindingContract } from "src/typescript_analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _property node analysis dependencies_. **/
export type TypeScriptPropertyNodeCollectorOptions = {
	readonly properties: Map<string, string>;
	readonly reference_binding: TypeScriptReferenceBindingContract;
	readonly call_owner: CallOwnerResolverContract;
};

/** Responsibilities: _property node ownership collection_. **/
export interface TypeScriptPropertyNodeCollectorContract {
	owner_context(node: ts.Node, inherited: TypeScriptPropertyContext): TypeScriptPropertyContext;
	append_node(node: ts.Node, context: TypeScriptPropertyContext): void;
}

/** Responsibilities: _property file entry context_. **/
export type TypeScriptPropertyInstanceFileEntryOptions = {
	readonly node: ts.Node;
	readonly owner_file: string;
	readonly owner_class: string;
	readonly imported_binding_files: ReadonlyMap<string, string>;
	readonly files: Map<string, string>;
	readonly declaration_predicates: DeclarationPredicatesContract;
};

/** Responsibilities: _property file entry registration_. **/
export interface TypeScriptPropertyInstanceFileEntryContract {
	append_type(): void;
	append_initializer(): void;
}

/** Responsibilities: _property instance file lookup_. **/
export interface TypeScriptPropertyInstanceFileLookupContract {
	file(owner_file: string, owner_class: string, name: string, side: TypeScriptPropertySide): string;
}
