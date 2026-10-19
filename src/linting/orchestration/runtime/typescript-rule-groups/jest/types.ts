import ts from "typescript";

export type JestScopeBindingMap = Map<string, ts.Declaration>;
export type JestScopeBindingMaps = WeakMap<ts.Node, JestScopeBindingMap>;
export type JestScopeParents = WeakMap<ts.Node, ts.Node>;
export type JestNodeScopes = WeakMap<ts.Node, ts.Node>;
export type JestExecutionConsumer = (node: ts.Node) => void;
