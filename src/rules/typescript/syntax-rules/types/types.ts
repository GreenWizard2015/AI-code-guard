import ts from "typescript";
import type { ModulePathResolver } from "src/module-resolution/types";
import type { SourceFileResolver } from "src/protocols";

export type RestUnionAliasDeclarations = ReadonlyMap<string, ts.TypeAliasDeclaration>;
export type RestUnionSourceAliasCache = WeakMap<ts.SourceFile, RestUnionAliasDeclarations>;
export type RestUnionResolverAliasCache = WeakMap<SourceFileResolver, RestUnionAliasDeclarations>;
export type RestUnionModuleAliasCache = WeakMap<ModulePathResolver, RestUnionResolverAliasCache>;
export type RestUnionPreparedAliasCache = WeakMap<ts.SourceFile, RestUnionModuleAliasCache>;
