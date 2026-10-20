import type { ProjectSourceOptions } from "src/model/types/types";
import type { LintInputFiles } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { CodingRuleSourceData } from "src/source_types";
import type { AstClassNode, AstLanguage, AstPythonImport, NormalizedAstFile } from "src/types";
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

/** Responsibilities: _source record language identity_, _source record data_. **/
export interface LintSourceRecordContract extends LintSourceRecord {
	typescript(): boolean;
	python(): boolean;
}

/** Responsibilities: _lint input file selection_, _explicit target handling_. **/
export interface LintInputFileSelectorContract {
	ignored_directories(repo_root: string, configured: readonly string[]): ReadonlySet<string>;
	input_files(repo_root: string, configured: readonly string[], explicit_files: readonly string[]): LintInputFiles;
}

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

/** Responsibilities: _AST model normalization_. **/
export interface AstModelContract {
	mark_external_bases(classes: AstClassNode[], project_class_names: ReadonlySet<string>): void;
	empty_ast_file(language: AstLanguage): NormalizedAstFile;
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

/** Responsibilities: _Gitignore configuration paths_. **/
export interface ParsedConfigurationFilesContract extends ReadonlySet<string> {
	add(file: string): void;
}

/** Responsibilities: _project source scanning_. **/
export interface ProjectSourceScannerContract {
	files(): string[];
	entry(file: string): boolean;
	resolved_imports(file: string, available: Set<string>): Set<string>;
	unresolved_relative_imports(file: string, available: ReadonlySet<string>): string[];
}

/** Responsibilities: _unused source analysis_. **/
export interface UnusedCodeContract {
	collect_unused_files(root: string, options: ProjectSourceOptions): ViolationContract[];
}

/** Responsibilities: _namespace type import resolution_. **/
export interface AstNamespaceTypeImportsContract {
	module(namespace: string): string;
	key(name: string): string;
}

/** Responsibilities: _project context import resolution_. **/
export interface ProjectSourceContextImportsContract {
	imports(file: string): string[];
	path(file: string, specifier: string): string;
	path_alias_configured(file: string, specifier: string): boolean;
	declaration_path(file: string, specifier: string, name: string): string;
}

/** Responsibilities: _project source entry classification_. **/
export interface ProjectSourceEntryContract {
	relative_path(file: string): string;
	entry(file: string): boolean;
}

/** Responsibilities: _Python source import resolution_. **/
export interface ProjectSourcePythonContract {
	select_import_candidate(base: string, files: ReadonlySet<string>): string;
	python_import_path(root: string, importer: string, specifier: string, files: ReadonlySet<string>): string;
	python_import(root: string, specifier: string, files: ReadonlySet<string>): boolean;
	append_import_names(
		specifiers: string[],
		item: AstPythonImport,
		root: string,
		importer: string,
		files: ReadonlySet<string>,
	): void;
}

/** Responsibilities: _AST property type resolution_. **/
export interface AstPropertyTypeContract {
	required_field(base: ts.Identifier, property: string): boolean;
	known_field(base: ts.Identifier, property: string): boolean;
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
