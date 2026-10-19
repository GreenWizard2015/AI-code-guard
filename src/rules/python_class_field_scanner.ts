import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonImportResolution } from "src/rules/python_import_resolution";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { StringSetMap, ViolationContract } from "src/protocols";
import type { LintProjectContextContract } from "src/protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { LintSourceRecord } from "src/types";
import type { PythonClassFieldCollectionOptions } from "src/model/types/types";
import { RULE_IDS } from "src/constants";
import type {
	AstClassNode,
	ClassFieldFiles,
	ImportedFunction,
	NormalizedAstFile,
	PythonProjectImportContext,
} from "src/types";
import type { ClassField, FieldContext } from "src/model/types/types";

/** Responsibilities: _Python class field analysis_, _annotation and initializer collection_. **/
export class PythonClassFieldScanner {
	private readonly python_extension = ".py";
	private readonly imported_field_rule = RULE_IDS.class_field_import;
	private readonly import_context: PythonProjectImportContext;

	/** Responsibilities: _creation violation externally initialization_. **/
	private field_violation(file: string, field: ClassField, context: FieldContext): ViolationContract[] {
		if (!this.is_indexed_external(field, file, context.imports, context.function_by_file)) {
			return [];
		}
		const rule = new DiagnosticRule(this.imported_field_rule);
		return [
			rule.violation(relative(context.repo_root, file), field.line + 1, {
				field: field.name,
				name: field.value_name,
			}),
		];
	}

	/** Responsibilities: _classification field references external_. **/
	private is_indexed_external(
		field: ClassField,
		file: string,
		imports: Map<string, ImportedFunction>,
		function_by_file: StringSetMap,
	): boolean {
		const imported = imports.get(field.value_name);
		if (imported === undefined) {
			return false;
		}
		if (imported.source_file === file) {
			return false;
		}
		return this.has_indexed_function(imported, function_by_file);
	}

	/** Responsibilities: _classification file indexing contains_. **/
	private has_indexed_function(imported: ImportedFunction, function_by_file: StringSetMap): boolean {
		const source_functions = function_by_file.get(imported.source_file);
		if (source_functions === undefined) {
			return false;
		}
		return source_functions.has(imported.source_name);
	}

	/** Responsibilities: _retrieval normalization Python AST_. **/
	private read_ast(file: string, sources: ReadonlyMap<string, LintSourceRecord>): NormalizedAstFile {
		const python_ast_parser = new PythonAstData(new PythonAstBridge());
		const source = sources.get(file);
		if (source !== undefined) {
			return source.normalized_ast;
		}
		return python_ast_parser.source_ast(readFileSync(file, "utf8"));
	}

	/** Responsibilities: _indexing Python functions source_. **/
	private index_functions(ast_by_file: Map<string, NormalizedAstFile>): StringSetMap {
		const result: StringSetMap = new Map();
		for (const [file, ast] of ast_by_file) {
			result.set(file, new Set(ast.functions.map((node) => node.name)));
		}
		return result;
	}

	/** Responsibilities: _aggregation violations Python class's_. **/
	private append_class_fields(
		violations: ViolationContract[],
		file: string,
		class_node: AstClassNode,
		context: FieldContext,
	): void {
		let fields = class_node.fields;
		if (fields === undefined) {
			fields = [];
		}
		for (const field of fields) {
			violations.push(...this.field_violation(file, field, context));
		}
	}

	/** Responsibilities: _collection Python class-field violations_. **/
	private collect_file(options: PythonClassFieldCollectionOptions): ViolationContract[] {
		let python_imports = options.ast.python_imports;
		if (python_imports === undefined) {
			python_imports = [];
		}
		const imports = options.python_import_resolution.collect_project_imports(
			options.file,
			python_imports,
			options.repo_root,
			options.files,
		);
		const violations: ViolationContract[] = [];
		for (const class_node of options.ast.classes) {
			this.append_class_fields(violations, options.file, class_node, {
				repo_root: options.repo_root,
				imports,
				function_by_file: options.function_by_file,
			});
		}
		return violations;
	}

	/** Responsibilities: _collection merge Python field_. **/
	private collect_fields(input: ClassFieldFiles, context_sources: readonly LintSourceRecord[]): ViolationContract[] {
		const { files, repo_root } = input;
		const python_files = files.filter((file) => file.endsWith(this.python_extension));
		const source_by_file = new Map(context_sources.map((source) => [source.absolute_path, source]));
		const ast_by_file = new Map(python_files.map((file) => [file, this.read_ast(file, source_by_file)]));
		const function_by_file = this.index_functions(ast_by_file);
		const python_import_resolution = new PythonImportResolution(this.import_context);
		const ast_entries = [...ast_by_file.entries()];
		return ast_entries.flatMap(([file, ast]) =>
			this.collect_file({
				file,
				ast,
				repo_root,
				function_by_file,
				files: this.import_context.files,
				python_import_resolution,
			}),
		);
	}

	/** Responsibilities: _Python import context_. **/
	public constructor(import_context: PythonProjectImportContext) {
		this.import_context = import_context;
	}

	/** Responsibilities: _collection Python class-field violations_. **/
	public collect_class_fields(files: string[], repo_root: string): ViolationContract[] {
		return this.collect_fields({ files, repo_root }, []);
	}

	/** Responsibilities: _collection Python class-field violations_. **/
	public collect_context_fields(
		files: string[],
		repo_root: string,
		context: LintProjectContextContract,
	): ViolationContract[] {
		return this.collect_fields({ files, repo_root }, context.files());
	}
}
