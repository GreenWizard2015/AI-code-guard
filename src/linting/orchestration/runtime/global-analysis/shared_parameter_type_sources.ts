import ts from "typescript";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { SharedParameterTypeSource, SharedParameterTypeSourcesContract } from "src/metrics/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import { PythonCompositionImports } from "src/linting/orchestration/runtime/composition/python_composition_imports";
import type { LintSourceRecord, PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _shared type source collection_, _imported type resolution_. **/
export class SharedParameterTypeSources implements SharedParameterTypeSourcesContract {
	private readonly repo_root: string;
	private readonly project_files: readonly string[];
	private readonly context: LintProjectContextContract;
	private readonly python_imports: PythonCompositionImports;

	/** Responsibilities: _TypeScript source-file map_. **/
	private typescript_source_files(): ReadonlyMap<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const source of this.context.files()) {
			if (source.language !== TYPESCRIPT_LANGUAGE) {
				continue;
			}
			source_files.set(source.absolute_path, source.typescript_ast.source_file_node());
		}
		return source_files;
	}

	/** Responsibilities: _type source registration_. **/
	private append_type_source(
		sources: Map<string, SharedParameterTypeSource>,
		key: string,
		source: SharedParameterTypeSource,
	): void {
		const previous = sources.get(key);
		if (previous === undefined) {
			sources.set(key, source);
			return;
		}
		if (previous.file !== source.file || previous.name !== source.name) {
			sources.set(key, { file: "", name: "" });
		}
	}

	/** Responsibilities: _local type source indexing_. **/
	private append_type_declarations(sources: Map<string, SharedParameterTypeSource>, source: LintSourceRecord): void {
		const names = [
			...source.normalized_ast.classes.map((item) => item.name),
			...source.normalized_ast.type_declarations.map((item) => item.name),
		];
		for (const name of names) {
			const type_source = { file: source.absolute_path, name };
			this.append_type_source(sources, name, type_source);
			this.append_type_source(sources, JSON.stringify([source.relative_path, name]), type_source);
		}
	}

	/** Responsibilities: _named import extraction_. **/
	private named_imports(statement: ts.ImportDeclaration): readonly ts.ImportSpecifier[] {
		const clause = statement.importClause;
		if (clause === undefined) {
			return [];
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _imported type source indexing_. **/
	private append_imported_binding(
		sources: Map<string, SharedParameterTypeSource>,
		source: LintSourceRecord,
		resolver: TypeScriptModuleExportsContract,
		imported_file: string,
		element: ts.ImportSpecifier,
	): void {
		let imported_name = element.name.text;
		if (element.propertyName !== undefined) {
			imported_name = element.propertyName.text;
		}
		const resolved = resolver.resolve(imported_file, imported_name);
		if (resolved.file.length === 0) {
			return;
		}
		const type_source = { file: resolved.file, name: resolved.name };
		const keys = new Set([
			JSON.stringify([source.relative_path, element.name.text]),
			JSON.stringify([source.relative_path, imported_name]),
			JSON.stringify([source.relative_path, resolved.name]),
		]);
		for (const key of keys) {
			this.append_type_source(sources, key, type_source);
		}
	}

	/** Responsibilities: _imported type source collection_. **/
	private append_imported_types(
		sources: Map<string, SharedParameterTypeSource>,
		source: LintSourceRecord,
		resolver: TypeScriptModuleExportsContract,
	): void {
		if (source.language !== TYPESCRIPT_LANGUAGE) {
			this.append_python_types(sources, source);
			return;
		}
		for (const statement of source.typescript_ast.source_file_node().statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const imported_file = resolver.module_symbol(source.absolute_path, statement.moduleSpecifier.text);
			if (imported_file.length === 0) {
				continue;
			}
			for (const element of this.named_imports(statement)) {
				this.append_imported_binding(sources, source, resolver, imported_file, element);
			}
		}
	}

	/** Responsibilities: _Python type source indexing_. **/
	private append_python_types(sources: Map<string, SharedParameterTypeSource>, source: LintSourceRecord): void {
		const imports = source.normalized_ast.python_imports;
		if (imports === undefined) {
			return;
		}
		const imported_symbols = this.python_imports.python_imports(source.absolute_path, imports);
		for (const [local_name, imported] of imported_symbols) {
			if (imported.file.length === 0 || imported.name.length === 0) {
				continue;
			}
			const type_source = { file: imported.file, name: imported.name };
			const keys = new Set([
				JSON.stringify([source.relative_path, local_name]),
				JSON.stringify([source.relative_path, imported.name]),
			]);
			for (const key of keys) {
				this.append_type_source(sources, key, type_source);
			}
		}
	}

	/** Responsibilities: _source catalog initialization_. **/
	public constructor(
		repo_root: string,
		project_files: readonly string[],
		context: LintProjectContextContract,
		python_import_context: PythonProjectImportContext,
	) {
		this.repo_root = repo_root;
		this.project_files = project_files;
		this.context = context;
		this.python_imports = new PythonCompositionImports(
			python_import_context,
			new Map(
				context
					.files()
					.filter((source) => source.language !== TYPESCRIPT_LANGUAGE)
					.map((source) => [source.absolute_path, source.normalized_ast] as const),
			),
		);
	}

	/** Responsibilities: _project type source collection_. **/
	public collect(): ReadonlyMap<string, SharedParameterTypeSource> {
		const sources = new Map<string, SharedParameterTypeSource>();
		const records = this.project_files.map((file) => this.context.source_record(file));
		for (const source of records) {
			this.append_type_declarations(sources, source);
		}
		const resolver = new TypeScriptModuleExports(
			this.repo_root,
			this.typescript_source_files(),
			false,
			this.context.source_io,
		);
		for (const source of records) {
			this.append_imported_types(sources, source, resolver);
		}
		return sources;
	}
}
