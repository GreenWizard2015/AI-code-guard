import type ts from "typescript";

export type StaticKeyCollectionState = {
	values: Map<string, string>;
	objects: Map<string, ts.ObjectLiteralExpression>;
};
export type CallableBodyKind = "unsupported" | "expression" | "declaration";
export type StaticExpressionValueMap = ReadonlyMap<string, string>;
export type StaticExpressionScopeValues = ReadonlyMap<ts.Node, StaticExpressionValueMap>;
export type StaticExpressionBindingNames = ReadonlySet<string>;
export type ObjectPropertyIndex = ReadonlyMap<string, ts.PropertyAssignment>;
