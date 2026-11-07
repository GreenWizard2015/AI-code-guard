import { resolve } from "node:path";
import type { CompositionModelContract } from "src/contracts/protocols/composition_protocols";
import type { PythonCompositionImportsContract } from "src/contracts/protocols/lint_runtime_protocols";
import { ClassDependencyMap } from "src/linting/composition/class_dependency_map";
import { PythonCompositionImports } from "src/linting/composition/python_composition_imports";
import { TypeScriptCompositionModel } from "src/linting/composition/type_script_composition_model";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { NormalizedAstSource } from "src/model/ast/normalized_ast_types";
import type { ClassGraph, CodeClass, CompositionResult } from "src/model_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";
import type ts from "typescript";

/** Responsibilities: _TypeScript composition parsing_, _Python composition parsing_. **/
export class CompositionModel implements CompositionModelContract {
	private readonly _python_language: "python";
	private readonly _project_root: string;
	private readonly _import_context: PythonProjectImportContext;
	private readonly _export_resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _TypeScript composition parsing_. **/
	private typescript_composition(source: LintSourceRecordData): CompositionResult {
		const builder = new TypeScriptCompositionModel(
			source.absolute_path,
			source.typescript_ast.source_file_node(),
			this._export_resolver,
		);
		return { classes: builder.classes(), imports: builder.imports() };
	}

	/** Responsibilities: _Python composition parsing_. **/
	private python_composition(
		source: LintSourceRecordData,
		python_composition_imports: PythonCompositionImportsContract,
	): CompositionResult {
		const classes = this.python_class_compositions(source.absolute_path, source.normalized_ast.source);
		return {
			classes,
			imports: python_composition_imports.python_imports(
				source.absolute_path,
				source.normalized_ast.source.python_imports,
			),
		};
	}

	/** Responsibilities: _Python class composition records_. **/
	private python_class_compositions(absolute_path: string, source: NormalizedAstSource): CodeClass[] {
		return source.classes.map((node) => {
			let dependencies: string[] = [];
			if (node.structure.dependencies !== undefined) {
				dependencies = node.structure.dependencies;
			}
			return {
				key: `${absolute_path}:${node.identity.name}`,
				file: absolute_path,
				line: node.identity.start,
				name: node.identity.name,
				dependencies,
				language: "python",
			};
		});
	}

	/** Responsibilities: _composition graph registration_. **/
	private append_composition(graph: ClassGraph, file: string, composition: CompositionResult): void {
		graph.imports_by_file.set(file, composition.imports);
		graph.classes_by_file.set(file, new Map(composition.classes.map((item) => [item.name, item])));
		for (const item of composition.classes) {
			graph.classes.set(item.key, item);
		}
	}

	/** Responsibilities: _initialization project module resolver_. **/
	public constructor(
		project_root: string,
		import_context: PythonProjectImportContext,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		this._python_language = "python";
		this._project_root = resolve(project_root);
		this._import_context = import_context;
		const export_context = new TypeScriptModuleExportsContext(
			this._project_root,
			source_files,
			filesystem_fallback,
			source_io,
		);
		this._export_resolver = export_context.module_exports();
	}

	/** Responsibilities: _composition graph source addition_. **/
	public add_files(graph: ClassGraph, sources: readonly LintSourceRecordData[]): void {
		const source_asts = new Map<string, NormalizedAstFile>();
		for (const source of sources) {
			if (source.language === this._python_language) {
				source_asts.set(source.absolute_path, source.normalized_ast);
			}
		}
		const python_composition_imports = new PythonCompositionImports(this._import_context, source_asts);
		for (const source of sources) {
			let composition: CompositionResult;
			if (source.language === this._python_language) {
				composition = this.python_composition(source, python_composition_imports);
			} else {
				composition = this.typescript_composition(source);
			}
			this.append_composition(graph, source.absolute_path, composition);
		}
	}

	/** Responsibilities: _composition graph_. **/
	public class_graph(sources: readonly LintSourceRecordData[]): ClassGraph {
		const graph: ClassGraph = {
			classes: new Map(),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		this.add_files(graph, sources);
		const resolver = new ClassDependencyMap(
			graph.classes,
			graph.classes_by_file,
			graph.imports_by_file,
			this._export_resolver,
		);
		resolver.all_items(graph.classes.values());
		return graph;
	}
}
