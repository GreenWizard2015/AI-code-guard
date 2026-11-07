import type {
	PythonCallableReferenceTargetMapperContract,
	PythonCompositionImportsContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { PythonCompositionImports } from "src/linting/composition/python_composition_imports";
import { PythonCallableReferenceMapping } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/python_callable_reference_mapping";
import type { AstCallableReference, AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { LintSourceRecordData, PythonProjectImportContext } from "src/source_types";

/** Responsibilities: _Python reference normalization_, _imported target resolution_. **/
export class PythonCallableReferenceTargetMapper implements PythonCallableReferenceTargetMapperContract {
	private readonly _project_root: string;
	private readonly _python_imports: PythonCompositionImportsContract;

	/** Responsibilities: _class name collection_. **/
	private source_class_names(classes: readonly AstClassNode[]): ReadonlySet<string> {
		const names = new Set<string>();
		for (const class_node of classes) {
			names.add(class_node.identity.name);
		}
		return names;
	}

	/** Responsibilities: _Python callable reference mapping_. **/
	private mapped_call_references(
		references: readonly AstCallableReference[],
		imports: ReadonlyMap<string, ImportedSymbol>,
		class_names: ReadonlySet<string>,
	): AstCallableReference[] {
		const mapped_references: AstCallableReference[] = [];
		for (const reference of references) {
			const mapping = new PythonCallableReferenceMapping(this._project_root, reference, imports, class_names);
			mapped_references.push(mapping.map());
		}
		return mapped_references;
	}

	/** Responsibilities: _source reference update_. **/
	private mapped_source_ast(ast: NormalizedAstFile, imports: ReadonlyMap<string, ImportedSymbol>): NormalizedAstFile {
		const class_names = this.source_class_names(ast.source.classes);
		const call_references = this.mapped_call_references(ast.references.call_references, imports, class_names);
		return { ...ast, references: { ...ast.references, call_references } };
	}

	/** Responsibilities: _Python callable target configuration_. **/
	public constructor(
		project_root: string,
		import_context: PythonProjectImportContext,
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
	) {
		this._project_root = project_root;
		this._python_imports = new PythonCompositionImports(import_context, source_asts);
	}

	/** Responsibilities: _Python source reference mapping_. **/
	public map_source(source: LintSourceRecordData): NormalizedAstFile {
		if (source.language !== "python") {
			return source.normalized_ast;
		}
		const imports = this._python_imports.python_imports(
			source.absolute_path,
			source.normalized_ast.source.python_imports,
		);
		return this.mapped_source_ast(source.normalized_ast, imports);
	}
}
