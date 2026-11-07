import type { ReadonlyStringSetMap } from "src/analysis_types";
import type {
	AstClassNode,
	AstLanguage,
	AstPythonImport,
	NamedLine,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import type { UnresolvedSpecifierInput, UnusedSourceOptions } from "src/model_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TextFileDiscoveryContract } from "src/runtime_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { CodingRuleSourceData } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _AST property binding resolution_. **/
export interface AstPropertyBindingIndexContract {
	register(source: ts.SourceFile, node: ts.Node): void;
	type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
}

/** Responsibilities: _AST property type resolution_. **/
export interface AstPropertyBindingResolverContract {
	type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
}

/** Responsibilities: _AST property source indexing_. **/
export interface AstPropertySourceIndexContract extends AstPropertyBindingResolverContract {
	declarations_for(source: ts.SourceFile): ReadonlyMap<string, ts.Declaration>;
}

/** Responsibilities: _lint input file selection_, _explicit target handling_. **/
export interface LintInputFileSelectorContract {
	ignored_directories(repo_root: string, configured: readonly string[]): ReadonlySet<string>;
	input_files(repo_root: string, configured: readonly string[], explicit_files: readonly string[]): LintInputFiles;
}

/** Responsibilities: _input discovery request_. **/
export type LintInputFileDiscoveryOptions = {
	readonly repo_root: string;
	readonly explicit_files: readonly string[];
	readonly ignored_directories: ReadonlySet<string>;
	readonly text_files: TextFileDiscoveryContract;
	readonly source_io: ProjectSourceIOContract;
};

/** Responsibilities: _complete-cache input discovery_. **/
export interface LintInputDiscoveryContract {
	input_files(repo_root: string, configured: readonly string[]): LintInputFiles;
}

/** Responsibilities: _source availability_, _source text access_. **/
export interface ProjectSourceContentIOContract {
	source_available(file: string): boolean;
	source_text(file: string): string;
}

/** Responsibilities: _project file inventory_. **/
export interface ProjectSourcePathCatalogContract {
	source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[];
}

/** Responsibilities: _source snapshot ownership_. **/
export interface ProjectSourceIOContract extends ProjectSourceContentIOContract, ProjectSourcePathCatalogContract {}

/** Responsibilities: _project source snapshot construction_. **/
export interface ProjectSourceSnapshotContract {
	source_paths(inputs: LintInputFiles): readonly string[];
	source_texts(inputs: LintInputFiles): ReadonlyMap<string, string>;
}

/** Responsibilities: _project-name membership_. **/
export interface ProjectNameMembershipContract {
	contains(name: string): boolean;
}

/** Responsibilities: _project-name membership lookup_. **/
export interface ProjectNameSetContract {
	has(name: string): boolean;
}

/** Responsibilities: _AST model normalization_. **/
export interface AstModelContract {
	mark_external_bases(classes: AstClassNode[], project_names: ProjectNameMembershipContract): void;
	empty_ast_file(): NormalizedAstFile;
}

/** Responsibilities: _persistent AST cache operations_. **/
export interface AstDiskCacheContract {
	clean_unused_records(): void;
	content(source_file: string, source_text: string): AstCacheEntryContract;
	write(source_file: string, source_text: string, ast: NormalizedAstFile): void;
}

/** Responsibilities: _cached AST state contract_, _language compatibility_. **/
export interface AstCacheEntryContract {
	present(): boolean;
	value(): NormalizedAstFile;
	complete(): boolean;
	should_reparse(): boolean;
	supports_language(language: AstLanguage): boolean;
}

/** Responsibilities: _cached AST source sections_. **/
export interface CachedAstSourceContract {
	arrays_valid(): boolean;
	declarations_valid(language: AstLanguage): boolean;
	named_line_valid(value: NamedLine): boolean;
	supported_language(): boolean;
}

/** Responsibilities: _Gitignore configuration paths_. **/
export interface ParsedConfigurationFilesContract extends ReadonlySet<string> {
	add(file: string): void;
}

/** Responsibilities: _project source scanning_. **/
export interface ProjectSourceScanContract {
	files(): string[];
	project_source_entry(): ProjectSourceEntryContract;
	reachable_files(files: readonly string[]): ReadonlySet<string>;
	external_symbol_usages(): ReadonlyStringSetMap;
	imports(file: string, available: Set<string>): ProjectSourceImportAnalysisContract;
	resolved_import_path(file: string, specifier: string, available: Set<string>): string;
}

/** Responsibilities: _import target indexing_, _specifier indexing_. **/
export interface ProjectSourceImportAnalysisContract {
	add_resolved(target: string): void;
	add_unresolved(specifier: string): void;
	resolved_targets(): ReadonlySet<string>;
	unresolved_specifiers(): readonly string[];
}

/** Responsibilities: _unused source analysis_. **/
export interface UnusedCodeContract {
	collect_unused_files(options: UnusedSourceOptions): ViolationContract[];
	unused_python_violations(options: UnusedSourceOptions): ViolationContract[];
}

/** Responsibilities: _namespace type import resolution_. **/
export interface AstNamespaceTypeImportsContract {
	module(namespace: string): string;
	key(name: string): string;
}

/** Responsibilities: _project context import resolution_. **/
export interface ProjectSourceContextImportsContract {
	imports(file: string): string[];
	resolve(file: string, specifier: string): ProjectSourceContextImportResolutionContract;
}

/** Responsibilities: _project source imports_. **/
export interface ProjectSourceImportsContract {
	path_alias_configured(specifier: string): boolean;
	specifier_path(file: string, specifier: string, files: Set<string>): string;
	import_specifiers(file: string, files: Set<string>): string[];
}

/** Responsibilities: _project import path cache_. **/
export interface ProjectSourceImportCacheContract {
	import_specifiers(file: string, files: Set<string>): string[];
	resolve(input: UnresolvedSpecifierInput): string;
	should_check(input: UnresolvedSpecifierInput): boolean;
}

/** Responsibilities: _project import result access_, _imported declaration lookup_. **/
export interface ProjectSourceContextImportResolutionContract {
	path(): string;
	path_alias_configured(): boolean;
	declaration_path(name: string): string;
}

export type ProjectSourceContextImportResolutionOptions = {
	context: LintProjectContextContract;
	source_files: ReadonlySet<string>;
	resolver: TypeScriptModuleExportsContract;
	module_file: string;
	resolved_path: string;
	path_alias_configured: boolean;
};

/** Responsibilities: _project source entry classification_. **/
export type ProjectSourcePath = {
	absolute: string;
	relative: string;
};

/** Responsibilities: _project source entry classification_. **/
export interface ProjectSourceEntryContract {
	relative_path(file: string): string;
	entry(file: string): boolean;
}

/** Responsibilities: _Python source import resolution_. **/
export interface ProjectSourcePythonContract {
	for_files(files: ReadonlySet<string>): PythonImportSessionContract;
}

/** Responsibilities: _Python import module resolution_. **/
export type PythonImportRequest = { importer: string; specifier: string };

/** Responsibilities: _Python import name expansion_. **/
export type PythonImportNamesRequest = { importer: string; item: AstPythonImport };

/** Responsibilities: _Python module identity_. **/
export type PythonModuleSpecifierRequest = { specifier: string };

/** Responsibilities: _Python import session_. **/
export interface PythonImportSessionContract {
	resolve_import(request: PythonImportRequest): string;
	project_import(request: PythonModuleSpecifierRequest): boolean;
	import_names(request: PythonImportNamesRequest): string[];
	select_import_candidate(base: string): string;
}

/** Responsibilities: _AST property type resolution_. **/
export interface AstPropertyTypeContract {
	field_state(base: ts.Identifier, property: string): string;
}

/** Responsibilities: _AST property source resolution_. **/
export interface AstPropertySourcesContract {
	declaration_key(file: string, name: string): string;
	binding_type(identifier: ts.Identifier): ts.TypeNode;
	declaration_exists(key: string): boolean;
	declaration(key: string): ts.Declaration;
}

/** Responsibilities: _AST property source graph_. **/
export interface AstPropertySourceGraphContract {
	source(file: string): ts.SourceFile;
	binding_type(identifier: ts.Identifier, unknown_type: ts.TypeNode): ts.TypeNode;
	declaration(key: string): AstDeclarationLookupContract;
}

/** Responsibilities: _AST declaration lookup_. **/
export interface AstDeclarationLookupContract {
	found(): boolean;
	value(): ts.Declaration;
	type_alias(): boolean;
	interface(): boolean;
}

/** Responsibilities: _coding source AST access_. **/
export interface SourceFileAstContract {
	snapshot(): CodingRuleSourceData;
	python(): boolean;
	typescript(): boolean;
}
