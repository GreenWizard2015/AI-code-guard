import type ts from "typescript";

export type StringSet = Set<string>;

export type StringSetMap = Map<string, StringSet>;

export type NumberSet = Set<number>;

export type StringNumberSetMap = Map<string, NumberSet>;

export type ReadonlyStringSet = ReadonlySet<string>;

export type ReadonlyStringSetMap = ReadonlyMap<string, ReadonlyStringSet>;

export type StringReadonlySetMap = Map<string, ReadonlyStringSet>;

export type ReadonlyStringMap = ReadonlyMap<string, string>;

export type StringStringMap = Map<string, string>;

export type StringBooleanMap = Map<string, boolean>;

export type StringReadonlyMap = Map<string, ReadonlyStringMap>;

export type NodeReadonlyStringSetMap = Map<ts.Node, ReadonlyStringSet>;

export type CallableReferenceKindTag = "function" | "method";

export type CallableObjectSourceVisitor = (source: ts.ObjectLiteralExpression) => void;

export type CallableArraySourceResolver = (
	binding: ts.ArrayBindingPattern,
	value: ts.Expression,
	name: string,
) => string;

export type CallableExpressionVisitor = (value: ts.Expression) => void;
