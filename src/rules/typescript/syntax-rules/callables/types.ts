import type ts from "typescript";

export type PlatformImportNames = ReadonlySet<string>;
export type PlatformImportNameCache = WeakMap<ts.SourceFile, PlatformImportNames>;
export type ProxyParameterNames = readonly string[];
export type ProxyCallCandidates = readonly ts.Node[];
