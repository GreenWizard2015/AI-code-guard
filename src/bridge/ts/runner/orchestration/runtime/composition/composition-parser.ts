import { PythonCompositionImports } from 'src/bridge/ts/runner/orchestration/runtime/composition/python-composition-imports';
import type { LintSourceRecord } from 'src/types';
import { ClassDependencyMap } from 'src/bridge/ts/runner/orchestration/runtime/composition/class-dependency-resolver';
import { TypeScriptCompositionModel } from 'src/bridge/ts/runner/orchestration/runtime/composition/typescript-composition-builder';
import type { AstPythonImport } from 'src/types';


import type { ClassGraph, CodeClass, CompositionResult } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _Python TypeScript source parsing_. **/
export class CompositionModel {
	private readonly python_language = 'python' as const;
	/** Responsibilities: _class nodes imports addition_. **/
	private add_file_classes(graph: ClassGraph, source: LintSourceRecord): void {
		const composition = this.parse_composition(source);
		graph.imports_by_file.set(source.absolute_path, composition.imports);
		graph.classes_by_file.set(
			source.absolute_path,
			new Map(composition.classes.map(item => [item.name, item]))
		);
		for (const item of composition.classes) {
			graph.classes.set(item.key, item);
		}
	}

	/** Responsibilities: _language-specific composition parsing_. **/
	private parse_composition(source: LintSourceRecord): CompositionResult {
		if (source.language !== this.python_language) {
			const builder = new TypeScriptCompositionModel(
				source.absolute_path,
				source.text,
				source.typescript_ast.source_file
			);
			return builder.composition();
		}
		return this.parse_python_composition(source);
	}

	/** Responsibilities: _Python class normalization_. **/
	private parse_python_composition(source: LintSourceRecord): CompositionResult {
		const python_composition_imports = new PythonCompositionImports();
		return {
			classes: this.python_classes(source),
			imports: python_composition_imports.python_imports(
				source.absolute_path,
				this.python_imports(source)
			),
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
		return ast.classes.map(node => {
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

	/** Responsibilities: _source files mutable addition_. **/
	public add_files(graph: ClassGraph, sources: readonly LintSourceRecord[]): void {
		for (const source of sources) {
			this.add_file_classes(graph, source);
		}
	}

	/** Responsibilities: _construction output project class_. **/
	public class_graph(sources: readonly LintSourceRecord[]): ClassGraph {
		const graph: ClassGraph = {
			classes: new Map(),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		this.add_files(graph, sources);
		const resolver = new ClassDependencyMap(graph.classes_by_file, graph.imports_by_file);
		resolver.all_items(graph.classes.values());
		return graph;
	}
}
