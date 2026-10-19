import type { TypeScriptContractNameLookupContract } from "src/protocols";
import type ts from "typescript";

/** Responsibilities: _scope alias names contract_. **/
export interface ObjectScopeAliasNamesContract extends ReadonlySet<string> {}

export type ObjectScopeAliasCache = WeakMap<ts.Node, ObjectScopeAliasNamesContract>;

/** Responsibilities: _contract alias registration contract_. **/
export interface ContractNameAliasLookupContract extends TypeScriptContractNameLookupContract {
	register_alias(name: string): void;
}
