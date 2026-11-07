import type { AstVisibility } from "src/model/ast/normalized_ast_types";
import type ts from "typescript";

export type CallableLineOf = (position: number) => number;

export type CallReferenceOptions = {
	readonly current_owner: string;
	readonly is_bound: boolean;
	readonly is_call: boolean;
};
export type NamedSymbolOptions = {
	is_module_constant: boolean;
	is_module_variable: boolean;
	visibility: AstVisibility;
	is_module_function: boolean;
};
export type ModuleSymbolFlags = {
	is_module_constant: boolean;
	is_module_variable: boolean;
};
export type TypeMember = { name: string; type: string };
export type SourceAliasNameSet = Set<string>;
export type SourceAliasLookupCache = WeakMap<ts.SourceFile, SourceAliasNameSet>;
