import { relative } from "node:path";
import type { StringSetMap } from "src/analysis_types";
import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { TypeScriptClassFieldSourceAnalysis } from "src/model/type_script_class_field_source_analysis";
import { TypeScriptImportedFunctionAliases } from "src/model/type_script_imported_function_aliases";
import type { TypeScriptClassFieldContext } from "src/model/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { TypeScriptImportedFunctionAliasesContract } from "src/typescript_analysis_types";

/** Responsibilities: _project class-field indexing_, _project class-field diagnostics_. **/
export class TypeScriptContextClassFieldAnalysis {
	private readonly _source_files: readonly string[];
	private readonly _repo_root: string;
	private readonly _context: LintProjectContextContract;

	/** Responsibilities: _function definitions index_. **/
	private function_index(files: readonly string[]): StringSetMap {
		const functions: StringSetMap = new Map();
		for (const file of files) {
			const source = this._context.source_record(file);
			functions.set(file, this.function_names(source.normalized_ast));
		}
		return functions;
	}

	/** Responsibilities: _source function-name index_. **/
	private function_names(ast: NormalizedAstFile): Set<string> {
		const names = new Set<string>();
		for (const callable of ast.source.functions) {
			names.add(callable.identity.name);
		}
		return names;
	}

	/** Responsibilities: _shared TypeScript import bindings_. **/
	private import_alias_index(): TypeScriptImportedFunctionAliasesContract {
		const shared_source_files = new Map(
			this._context
				.files()
				.filter((source) => source.language === TYPESCRIPT_CACHE_OWNER)
				.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
		);
		return new TypeScriptImportedFunctionAliases(
			this._repo_root,
			shared_source_files,
			false,
			this._context.source_io(),
		);
	}

	/** Responsibilities: _source-file class-field diagnostics_. **/
	private source_analysis(
		file: string,
		functions: StringSetMap,
		imported_function_aliases: TypeScriptImportedFunctionAliasesContract,
	): ViolationContract[] {
		const source = this._context.source_record(file);
		if (source.language !== TYPESCRIPT_CACHE_OWNER) {
			return [];
		}
		const source_file = source.typescript_ast.source_file_node();
		const imports = imported_function_aliases.imported_function_aliases(source_file);
		const source_context: TypeScriptClassFieldContext = {
			file,
			relative_file: relative(this._repo_root, file).split("\\").join("/"),
			source_file,
			imports,
			functions,
		};
		const source_analysis = new TypeScriptClassFieldSourceAnalysis(source_context, imported_function_aliases);
		return source_analysis.collect();
	}

	/** Responsibilities: _project analysis input initialization_. **/
	public constructor(files: readonly string[], repo_root: string, context: LintProjectContextContract) {
		this._repo_root = repo_root;
		this._context = context;
		const unique_files = [...new Set(files)];
		this._source_files = unique_files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
	}

	/** Responsibilities: _TypeScript source count_. **/
	public typescript_source_count(): number {
		return this._source_files.length;
	}

	/** Responsibilities: _project class-field violations collection_. **/
	public collect(): ViolationContract[] {
		if (this.typescript_source_count() === 0) {
			return [];
		}
		const functions = this.function_index(this._source_files);
		const imported_function_aliases = this.import_alias_index();
		return this._source_files.flatMap((file) => this.source_analysis(file, functions, imported_function_aliases));
	}
}
