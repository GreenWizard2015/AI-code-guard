import type ts from "typescript";

/** Responsibilities: _callable patch classification_. **/
export interface RuntimePatchAliasIndexContract {
	callable_replacement(expression: ts.Expression): boolean;
	framework_patch(call: ts.CallExpression): boolean;
}

/** Responsibilities: _framework alias resolution_. **/
export interface RuntimePatchFrameworkAliasesContract {
	methods(): ReadonlySet<string>;
	expression_matches(expression: ts.Expression, node: ts.Node): boolean;
}

/** Responsibilities: _framework alias registry_. **/
export type RuntimePatchFrameworkAliasIndex = Map<string, RuntimePatchFrameworkAliasesContract>;

/** Responsibilities: _source scoped patch alias indexes_. **/
export type RuntimePatchAliases = WeakMap<ts.SourceFile, RuntimePatchAliasIndexContract>;

/** Responsibilities: _callable alias name collection_. **/
export type CallableNameSet = Set<string>;

/** Responsibilities: _AST expression lexical context_. **/
export type RuntimePatchExpressionContext = {
	readonly expression: ts.Expression;
	readonly scope: ts.Node;
};
