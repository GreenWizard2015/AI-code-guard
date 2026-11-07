import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type { SharedParameterTypeSourceIndexContract } from "src/contracts/protocols/lint_runtime_protocols";
import { PythonCompositionImports } from "src/linting/composition/python_composition_imports";
import { SharedParameterSourceImports } from "src/linting/orchestration/runtime/global-analysis/diagnostics/shared_parameter_source_imports";
import type { SharedParameterTypeSource, SharedParameterTypeSourcesContract } from "src/metrics/types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _parameter type source collection_, _import resolution_. **/
export class SharedParameterTypeSources
	implements SharedParameterTypeSourcesContract, SharedParameterTypeSourceIndexContract
{
	private readonly _project_files: readonly string[];
	private readonly _context: LintProjectContextContract;
	private readonly _python_imports: PythonCompositionImports;
	private readonly _sources: Map<string, SharedParameterTypeSource>;
	private readonly _resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _TypeScript source-file map_. **/
	private typescript_source_files(): ReadonlyMap<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const source of this._context.files()) {
			if (source.language !== TYPESCRIPT_LANGUAGE) {
				continue;
			}
			source_files.set(source.absolute_path, source.typescript_ast.source_file_node());
		}
		return source_files;
	}

	/** Responsibilities: _local type source indexing_. **/
	private append_declarations(records: readonly LintSourceRecordData[]): void {
		for (const source of records) {
			const normalized_ast = source.normalized_ast;
			const classes = normalized_ast.source.classes;
			const declarations = normalized_ast.references.type_declarations;
			const names = [...classes.map((item) => item.identity.name), ...declarations.map((item) => item.name)];
			for (const name of names) {
				this.append([name, JSON.stringify([source.relative_path, name])], {
					file: source.absolute_path,
					name,
				});
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
		this._project_files = project_files;
		this._context = context;
		this._sources = new Map();
		const resolver_context = new TypeScriptModuleExportsContext(
			repo_root,
			this.typescript_source_files(),
			false,
			context.source_io(),
		);
		this._resolver = resolver_context.module_exports();
		this._python_imports = new PythonCompositionImports(
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
		this.clear();
		const records = this._project_files.map((file) => this._context.source_record(file));
		this.append_declarations(records);
		for (const source of records) {
			const source_imports = new SharedParameterSourceImports(source, this._resolver, this._python_imports, this);
			if (source.language === TYPESCRIPT_LANGUAGE) {
				source_imports.append_typescript_imports();
				continue;
			}
			source_imports.append_python_imports();
		}
		return this.entries();
	}

	/** Responsibilities: _type source registration_. **/
	public append(keys: Iterable<string>, type_source: SharedParameterTypeSource): void {
		for (const key of keys) {
			const previous = this._sources.get(key);
			if (previous === undefined) {
				this._sources.set(key, type_source);
				continue;
			}
			if (previous.file !== type_source.file || previous.name !== type_source.name) {
				this._sources.set(key, { file: "", name: "" });
			}
		}
	}

	/** Responsibilities: _shared parameter source entries_. **/
	public entries(): ReadonlyMap<string, SharedParameterTypeSource> {
		return this._sources;
	}

	/** Responsibilities: _shared parameter source reset_. **/
	public clear(): void {
		this._sources.clear();
	}
}
