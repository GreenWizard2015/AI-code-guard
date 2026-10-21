import { PythonCompositionImports } from "src/linting/orchestration/runtime/composition/python_composition_imports";
import type { PythonCompositionImportsContract } from "src/linting/orchestration/runtime/protocols";
import type { LintSourceRecord, PythonProjectImportContext } from "src/source_types";
import type { NormalizedAstFileContract } from "src/types";
import { ClassDependencyMap } from "src/linting/orchestration/runtime/global-analysis/class_dependency_map";
import { TypeScriptCompositionModel } from "src/linting/orchestration/runtime/global-analysis/type_script_composition_model";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { AstPythonImport } from "src/types";
import type { ClassGraph, CodeClass, CompositionResult } from "src/model/types/types";
import { resolve } from "node:path";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type ts from "typescript";

/** Responsibilities: _TypeScript composition parsing_, _Python composition parsing_. **/
export class CompositionModel {
	private readonly python_language = "python" as const;
	private readonly project_root: string;
	private readonly import_context: PythonProjectImportContext;
	private readonly export_resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _class nodes imports addition_. **/
	private add_file_classes(
		graph: ClassGraph,
		source: LintSourceRecord,
		python_composition_imports: PythonCompositionImportsContract,
	): void {
		const composition = this.parse_composition(source, python_composition_imports);
		graph.imports_by_file.set(source.absolute_path, composition.imports);
		graph.classes_by_file.set(source.absolute_path, new Map(composition.classes.map((item) => [item.name, item])));
		for (const item of composition.classes) {
			graph.classes.set(item.key, item);
		}
	}

	/** Responsibilities: _language-specific composition parsing_. **/
	private parse_composition(
		source: LintSourceRecord,
		python_composition_imports: PythonCompositionImportsContract,
	): CompositionResult {
		if (source.language !== this.python_language) {
			const builder = new TypeScriptCompositionModel(
				source.absolute_path,
				source.typescript_ast.source_file_node(),
				this.export_resolver,
			);
			return { classes: builder.classes(), imports: builder.imports() };
		}
		return this.parse_python_composition(source, python_composition_imports);
	}

	/** Responsibilities: _Python composition parsing_. **/
	private parse_python_composition(
		source: LintSourceRecord,
		python_composition_imports: PythonCompositionImportsContract,
	): CompositionResult {
		return {
			classes: this.python_classes(source),
			imports: python_composition_imports.python_imports(source.absolute_path, this.python_imports(source)),
		};
	}

	/** Responsibilities: _retrieval Python import records_. **/
	private python_imports(source: LintSourceRecord): AstPythonImport[] {
		const imports = source.normalized_ast.python_imports;
		if (imports === undefined) {
			return [];
		}
		return imports;
	}

	/** Responsibilities: _normalization Python classes conversion_. **/
	private python_classes(source: LintSourceRecord): CodeClass[] {
		const ast = source.normalized_ast;
		return ast.classes.map((node) => {
			let dependencies = node.dependencies;
			if (dependencies === undefined) {
				dependencies = [];
			}
			return {
				key: `${source.absolute_path}:${node.name}`,
				file: source.absolute_path,
				line: node.start,
				name: node.name,
				dependencies,
			};
		});
	}

	/** Responsibilities: _initialization project module resolver_. **/
	public constructor(
		project_root: string,
		import_context: PythonProjectImportContext,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		source_io: ProjectSourceIOContract,
	) {
		this.project_root = resolve(project_root);
		this.import_context = import_context;
		this.export_resolver = new TypeScriptModuleExports(
			this.project_root,
			source_files,
			filesystem_fallback,
			source_io,
		);
	}

	/** Responsibilities: _source files mutable addition_. **/
	public add_files(graph: ClassGraph, sources: readonly LintSourceRecord[]): void {
		const source_asts = new Map<string, NormalizedAstFileContract>();
		for (const source of sources) {
			if (source.language === this.python_language) {
				source_asts.set(source.absolute_path, source.normalized_ast);
			}
		}
		const python_composition_imports = new PythonCompositionImports(this.import_context, source_asts);
		for (const source of sources) {
			this.add_file_classes(graph, source, python_composition_imports);
		}
	}

	/** Responsibilities: _composition graph_. **/
	public class_graph(sources: readonly LintSourceRecord[]): ClassGraph {
		const graph: ClassGraph = {
			classes: new Map(),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		this.add_files(graph, sources);
		const resolver = new ClassDependencyMap(graph.classes_by_file, graph.imports_by_file, this.export_resolver);
		resolver.all_items(graph.classes.values());
		return graph;
	}
}
