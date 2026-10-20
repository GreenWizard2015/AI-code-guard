import ts from "typescript";
import type { ModulePathResolver } from "src/module-resolution/types";
import type { SourceFileResolver } from "src/source_types";

export type RestUnionAliasDeclarations = ReadonlyMap<
	string,
	ts.TypeAliasDeclaration
>;
export type RestUnionResolverAliasCache = WeakMap<
	SourceFileResolver,
	RestUnionAliasDeclarations
>;
export type RestUnionSourceAliasCache = WeakMap<
	ts.SourceFile,
	RestUnionAliasDeclarations
>;
export type RestUnionSourceModuleCache = WeakMap<
	ModulePathResolver,
	RestUnionResolverAliasCache
>;
export type RestUnionPreparedAliasCache = WeakMap<
	ts.SourceFile,
	RestUnionSourceModuleCache
>;
