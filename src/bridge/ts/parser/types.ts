import type { AstVisibility } from "src/types";

export type LineOf = (position: number) => number;

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
export type TypeMember = { name: string; type: string };
