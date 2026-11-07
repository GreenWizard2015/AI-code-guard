import type { ModulePathResolverContract } from "src/module-resolution/types";
import type { SourceFileResolver } from "src/source_types";
import type { RuleContextContract } from "src/types";
import type ts from "typescript";

export type BlockDeclarationNames = ReadonlySet<string>;

export type CallableNamedFieldIndex = (owner: ts.Node) => ReadonlyMap<string, ts.Node>;
export type CallableMatchingAliasFields = (fields: ReadonlyMap<string, ts.Node>, names: readonly string[]) => boolean;

export type RestUnionAliasDeclarations = ReadonlyMap<string, ts.TypeAliasDeclaration>;
export type RestUnionResolverAliasCache = WeakMap<SourceFileResolver, RestUnionAliasDeclarations>;
export type RestUnionSourceAliasCache = WeakMap<ts.SourceFile, RestUnionAliasDeclarations>;
export type RestUnionSourceModuleCache = WeakMap<ModulePathResolverContract, RestUnionResolverAliasCache>;
export type RestUnionPreparedAliasCache = WeakMap<ts.SourceFile, RestUnionSourceModuleCache>;
export type RestUnionSourceAliasesOptions = {
	source_file: ts.SourceFile;
	module_path: ModulePathResolverContract;
	source_resolver: SourceFileResolver;
	alias_cache: RestUnionSourceAliasCache;
	local_aliases: RestUnionAliasDeclarations;
};
export type FiniteVariantMembers = Set<string>;
export type FiniteVariantIndex = Map<string, FiniteVariantMembers>;
export type FiniteVariantDiscriminantIndex = Map<string, string>;
export type FiniteVariantLiteralFields = ReadonlyMap<string, string>;
export type FiniteVariantLiteralFieldIndex = Map<string, FiniteVariantLiteralFields>;
/** Responsibilities: _finite type member lookup_, _discriminant ownership_. **/
export type FiniteVariantSourceIndex = {
	readonly members: FiniteVariantIndex;
	readonly discriminants: FiniteVariantDiscriminantIndex;
};
export type FiniteVariantNodeList = readonly ts.TypeNode[];
export type FiniteVariantImportList = readonly ts.ImportSpecifier[];
export type FiniteVariantSourceCache = WeakMap<ts.SourceFile, FiniteVariantSourceIndex>;
export type FiniteVariantImportNames = Map<string, string>;
/** Responsibilities: _finite-variant switch application_. **/
export interface FiniteVariantSwitchAnalysisContract {
	append_switch(node: ts.SwitchStatement, context: RuleContextContract): void;
}
/** Responsibilities: _switch source identity_, _finite source member lookup_. **/
export interface FiniteVariantSwitchSourceAnalysisContract {
	owner(node: ts.Node): ts.Node;
	source_name(node: ts.Expression): string;
	source_type(owner: ts.Node, name: string): string;
	target_type(owner: ts.Node): string;
	source_variants(node: ts.SwitchStatement, owner: ts.Node): FiniteVariantMembers;
}

/** Responsibilities: _discriminated union literal indexing_. **/
export interface FiniteVariantDiscriminatedUnionIndexContract {
	reset_source(): void;
	append_literals(node: ts.Node): void;
	append_unions(union_declarations: readonly ts.TypeAliasDeclaration[], index: FiniteVariantSourceIndex): void;
}

/** Responsibilities: _enum member identity lookup_. **/
export interface FiniteVariantEnumIndexContract {
	read(node: ts.EnumDeclaration): void;
	members(): FiniteVariantMembers;
}
export type TypeScriptMemberSet = Set<string>;
export type TypeScriptNameMap = Map<string, TypeScriptMemberSet>;
export type TypeScriptMutableClasss = Map<string, TypeScriptNameMap>;
export type TypeScriptImportedImplementationIndex = Map<string, TypeScriptNameMap>;
/** Responsibilities: _collaborator contract indexing_, _implementation member lookup_. **/
export interface TypeScriptCollaboratorTypeIndexContract {
	prepare(): void;
	for_class(class_name: string): TypeScriptNameMap;
}
/** Responsibilities: _contract membership preparation_, _implementation member lookup_. **/
export interface TypeScriptImplementedTypeIndexContract {
	prepare(source_file: ts.SourceFile): void;
	implemented_members(class_name: string, contract_name: string): ReadonlySet<string>;
}
/** Responsibilities: _typed collaborator creation metadata_. **/
export type TypeScriptCreationAlias = {
	readonly creation: ts.NewExpression;
	readonly methods: TypeScriptMemberSet;
};
export type TypeScriptCreationAliasIndex = Map<string, TypeScriptCreationAlias>;
