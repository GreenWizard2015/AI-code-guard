import type { TypeScriptImplementedTypeIndexContract } from "src/rules/typescript/syntax-rules/types/types";
import type ts from "typescript";

/** Responsibilities: _guard branch_, _source contract index_. **/
export type DowncastBranchQuery = {
	readonly condition: ts.BinaryExpression;
	readonly branch: ts.IfStatement;
	readonly index: TypeScriptImplementedTypeIndexContract;
};

/** Responsibilities: _downcast classification_, _candidate identity_. **/
export type DowncastQuery = {
	readonly condition: ts.BinaryExpression;
	readonly branch: ts.IfStatement;
	readonly index: TypeScriptImplementedTypeIndexContract;
	readonly receiver: string;
	readonly implementation: string;
};

/** Responsibilities: _implementation call search_, _contract member boundary_. **/
export type MethodCallSearch = {
	readonly body: ts.Node;
	readonly receiver: string;
	readonly contract_members: ReadonlySet<string>;
};
