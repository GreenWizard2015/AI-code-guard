import type { AbsoluteImportCandidate } from "src/source_types";
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

export type StringArrayMap = Map<string, string[]>;

export type StringBooleanMap = Map<string, boolean>;

export type StringReadonlyMap = Map<string, ReadonlyStringMap>;

export type NodeReadonlyStringSetMap = Map<ts.Node, ReadonlyStringSet>;

export type StringAbsoluteImportMap = Map<string, AbsoluteImportCandidate>;

export type AbsoluteImportRootIndex = Map<string, StringAbsoluteImportMap>;

/** Responsibilities: _array element resolution_. **/
export type ArrayElementsResolverContract = (initializer: ts.ArrayLiteralExpression) => readonly ts.Expression[];

export type CallableReferenceKindContract = "function" | "method";

export type NestedFactoryExpressionsResolver = (
	binding: ts.ArrayBindingPattern,
	initializer: ts.Expression,
	name: string,
) => ReadonlyMap<string, ts.FunctionLikeDeclarationBase>;

export type ObjectSourceVisitor = (source: ts.ObjectLiteralExpression) => void;

export type ArraySourceResolver = (binding: ts.ArrayBindingPattern, value: ts.Expression, name: string) => string;

export type ExpressionVisitor = (value: ts.Expression) => void;
