import type { TypeScriptStaticExpressionBindingsContract } from "src/parser/typescript-aliases/protocols";
import type ts from "typescript";

export type TypeScriptStaticExpressionBindingNames = ReadonlySet<string>;
export type TypeScriptStaticExpressionBindingNameCache = WeakMap<ts.Node, TypeScriptStaticExpressionBindingNames>;
export type TypeScriptStaticExpressionValueCollection<TNode extends ts.Node = ts.Node> = {
	readonly values: Map<string, string>;
	readonly node: TNode;
	readonly bindings: TypeScriptStaticExpressionBindingsContract;
};
export type TypeScriptStaticExpressionTraversal = {
	readonly values: Map<string, string>;
	readonly node: ts.Node;
	readonly root: ts.Node;
	readonly bindings: TypeScriptStaticExpressionBindingsContract;
};
export type TypeScriptStaticExpressionScopeCollection = {
	readonly scope: ts.Node;
	readonly bindings: TypeScriptStaticExpressionBindingsContract;
};
export type TypeScriptStaticExpressionScopesCollection = {
	readonly scopes: readonly ts.Node[];
	readonly bindings: TypeScriptStaticExpressionBindingsContract;
};
export type TypeScriptStaticExpressionBindingNameTraversal = {
	readonly names: Set<string>;
	readonly node: ts.Node;
	readonly root: ts.Node;
};
export type TypeScriptStaticExpressionScopePath = {
	readonly owner: ts.Node;
	readonly scopes: readonly ts.Node[];
};
