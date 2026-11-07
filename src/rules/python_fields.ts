import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { StringSetMap } from "src/analysis_types";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { RULE_IDS } from "src/linting/constants";
import type {
	AstClassNode,
	ClassFieldFiles,
	ImportedFunction,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type {
	ClassField,
	FieldContext,
	PythonClassFieldCollectionOptions,
	PythonClassFieldReference,
	PythonProjectFieldContext,
	PythonProjectFieldSource,
} from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { PythonImportResolution } from "src/rules/python_import_resolution";
import type { LintSourceRecordData } from "src/source_types";
import type { PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _Python class-field imports_, _function ownership_. **/
export class PythonFields {
	private readonly extension = ".py";
	private readonly _field_rule: string;
	private readonly _import_context: PythonProjectImportContext;

	/** Responsibilities: _class-field rule mapping_. **/
	private field_issue(file: string, root: string, field: ClassField): ViolationContract {
		const rule = new DiagnosticRule(this._field_rule);
		return rule.violation(relative(root, file), field.line + 1, {
			field: field.name,
			name: field.value_name,
		});
	}

	/** Responsibilities: _imported field ownership_. **/
	private field_violation(
		source_file: string,
		reference: PythonClassFieldReference,
		context: FieldContext,
	): ViolationContract[] {
		const { field, class_node } = reference;
		const imported = context.imports.get(field.value_name);
		if (imported === undefined || imported.source_file === source_file) {
			return [];
		}
		if (this.name_shadowed(class_node, field.value_name, field.line)) {
			return [];
		}
		if (!this.function_indexed(imported, context.function_by_file)) {
			return [];
		}
		return [this.field_issue(source_file, context.repo_root, field)];
	}

	/** Responsibilities: _class-scope name shadowing_. **/
	private name_shadowed(class_node: AstClassNode, name: string, line: number): boolean {
		for (const method of class_node.structure.methods) {
			if (method.identity.name === name && method.identity.start < line) {
				return true;
			}
		}
		for (const member of class_node.field_analysis.fields ?? []) {
			if (member.class_scope && member.name === name && member.line < line) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _source function membership_. **/
	private function_indexed(imported: ImportedFunction, function_map: StringSetMap): boolean {
		const functions = function_map.get(imported.source_file);
		if (functions === undefined) {
			return false;
		}
		return functions.has(imported.source_name);
	}

	/** Responsibilities: _Python AST source reading_. **/
	private read_ast(source_path: string, sources: ReadonlyMap<string, LintSourceRecordData>): NormalizedAstFile {
		const source = sources.get(source_path);
		if (source !== undefined) {
			return source.normalized_ast;
		}
		const python_ast_bridge = new PythonAstBridge();
		const python_ast_options = python_ast_bridge.options();
		const parser = new PythonAstData(python_ast_options);
		return parser.source_ast(readFileSync(source_path, "utf8"));
	}

	/** Responsibilities: _project function index_. **/
	private index_functions(ast_by_file: Map<string, NormalizedAstFile>): StringSetMap {
		const result: StringSetMap = new Map();
		for (const [file, ast] of ast_by_file) {
			result.set(file, new Set(ast.source.functions.map((node) => node.identity.name)));
		}
		return result;
	}

	/** Responsibilities: _file import state_. **/
	private field_context(options: PythonClassFieldCollectionOptions): FieldContext {
		const python_imports = options.ast.source.python_imports ?? [];
		const imports = options.python_import_resolution.collect_project_imports(
			options.file,
			python_imports,
			options.repo_root,
			options.files,
		);
		return {
			repo_root: options.repo_root,
			imports,
			function_by_file: options.function_by_file,
		};
	}

	/** Responsibilities: _project Python source preparation_. **/
	private project_source_files(
		files: readonly string[],
		context_sources: readonly LintSourceRecordData[],
	): Map<string, NormalizedAstFile> {
		const python_files = files.filter((file) => file.endsWith(this.extension));
		const source_map = new Map(context_sources.map((source) => [source.absolute_path, source]));
		return new Map(python_files.map((file) => [file, this.read_ast(file, source_map)]));
	}

	/** Responsibilities: _project file field collection_. **/
	private collect_project_file(project_source: PythonProjectFieldSource): ViolationContract[] {
		const { file, ast, project } = project_source;
		return this.collect_file({
			file,
			ast,
			repo_root: project.repo_root,
			function_by_file: project.function_by_file,
			files: project.files,
			python_import_resolution: project.python_import_resolution,
		});
	}

	/** Responsibilities: _project field aggregation_. **/
	private collect_project_files(
		ast_by_file: ReadonlyMap<string, NormalizedAstFile>,
		project: PythonProjectFieldContext,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const [file, ast] of ast_by_file) {
			const findings = this.collect_project_file({ file, ast, project });
			for (const finding of findings) {
				violations.push(finding);
			}
		}
		return violations;
	}

	/** Responsibilities: _Python import context_. **/
	public constructor(import_context: PythonProjectImportContext) {
		this._field_rule = RULE_IDS.class_field_import;
		this._import_context = import_context;
	}

	/** Responsibilities: _per-file class-field imports_. **/
	public collect_file(options: PythonClassFieldCollectionOptions): ViolationContract[] {
		const context = this.field_context(options);
		const violations: ViolationContract[] = [];
		for (const class_node of options.ast.source.classes) {
			const field_analysis = class_node.field_analysis;
			const fields = field_analysis.fields ?? [];
			for (const field of fields) {
				const findings = this.field_violation(options.file, { class_node, field }, context);
				for (const finding of findings) {
					violations.push(finding);
				}
			}
		}
		return violations;
	}

	/** Responsibilities: _project class-field imports_. **/
	public collect_fields(input: ClassFieldFiles, context_sources: readonly LintSourceRecordData[]): ViolationContract[] {
		const ast_map = this.project_source_files(input.files, context_sources);
		const function_map = this.index_functions(ast_map);
		const project: PythonProjectFieldContext = {
			repo_root: input.repo_root,
			function_by_file: function_map,
			files: this._import_context.files,
			python_import_resolution: new PythonImportResolution(this._import_context),
		};
		return this.collect_project_files(ast_map, project);
	}
}
