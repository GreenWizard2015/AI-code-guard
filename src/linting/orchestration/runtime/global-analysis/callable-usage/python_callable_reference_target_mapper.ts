import { relative } from "node:path";
import { PythonCompositionImports } from "src/linting/orchestration/runtime/composition/python_composition_imports";
import type { LintSourceRecord, PythonProjectImportContext } from "src/source_types";
import type { AstCallableReference, ImportedSymbol, NormalizedAstFileContract } from "src/types";
import type {
	PythonCallableReferenceTargetMapperContract,
	PythonCompositionImportsContract,
} from "src/linting/orchestration/runtime/protocols";
import { CONTRACT_SUFFIX, METRIC_KIND_FUNCTION } from "src/metrics/constants";

/** Responsibilities: _Python reference normalization_, _imported target resolution_. **/
export class PythonCallableReferenceTargetMapper implements PythonCallableReferenceTargetMapperContract {
	private readonly project_root: string;
	private readonly python_imports: PythonCompositionImportsContract;
	private readonly empty_symbol: ImportedSymbol = { file: "", name: "" };

	/** Responsibilities: _reference target normalization_. **/
	private normalized_reference(reference: AstCallableReference): AstCallableReference {
		const target_file = reference.target_file;
		if (typeof target_file === "string") {
			return reference;
		}
		return { ...reference, target_file: "" };
	}

	/** Responsibilities: _module-level Python method detection_. **/
	private is_module_level(reference: AstCallableReference, class_names: ReadonlySet<string>): boolean {
		const caller_owner = reference.caller_owner;
		if (caller_owner === undefined || caller_owner.length === 0) {
			return true;
		}
		return !class_names.has(caller_owner);
	}

	/** Responsibilities: _imported Python function selection_. **/
	private imported_function(
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
	): ImportedSymbol {
		const imported = imports.get(reference.name);
		if (imported === undefined) {
			return this.empty_symbol;
		}
		return imported;
	}

	/** Responsibilities: _Python method owner extraction_. **/
	private method_owner(reference: AstCallableReference): string {
		const owner = reference.owner;
		if (owner === undefined) {
			return "";
		}
		if (owner.length === 0) {
			return "";
		}
		if (owner.endsWith(CONTRACT_SUFFIX)) {
			return "";
		}
		return owner;
	}

	/** Responsibilities: _imported Python owner selection_. **/
	private imported_owner(owner: string, imports: ReadonlyMap<string, ImportedSymbol>): ImportedSymbol {
		const imported = imports.get(owner);
		if (imported === undefined || imported.file.length === 0) {
			return this.empty_symbol;
		}
		return imported;
	}

	/** Responsibilities: _imported Python method selection_. **/
	private imported_method(
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
		class_names: ReadonlySet<string>,
	): ImportedSymbol {
		const owner = this.method_owner(reference);
		if (owner.length === 0) {
			return this.empty_symbol;
		}
		if (!this.is_module_level(reference, class_names)) {
			return this.empty_symbol;
		}
		return this.imported_owner(owner, imports);
	}

	/** Responsibilities: _imported Python symbol selection_. **/
	private imported_symbol(
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
		class_names: ReadonlySet<string>,
	): ImportedSymbol {
		if (reference.kind === METRIC_KIND_FUNCTION) {
			return this.imported_function(reference, imports);
		}
		return this.imported_method(reference, imports, class_names);
	}

	/** Responsibilities: _Python callable target configuration_. **/
	public constructor(
		project_root: string,
		import_context: PythonProjectImportContext,
		source_asts: ReadonlyMap<string, NormalizedAstFileContract>,
	) {
		this.project_root = project_root;
		this.python_imports = new PythonCompositionImports(import_context, source_asts);
	}

	/** Responsibilities: _Python callable reference target_. **/
	public map_reference(
		reference: AstCallableReference,
		imports: ReadonlyMap<string, ImportedSymbol>,
		class_names: ReadonlySet<string>,
	): AstCallableReference {
		const normalized = this.normalized_reference(reference);
		const imported = this.imported_symbol(reference, imports, class_names);
		if (imported.file.length === 0) {
			return normalized;
		}
		let name = imported.name;
		if (reference.kind === "method") {
			name = reference.name;
		}
		return {
			...normalized,
			name,
			target_file: relative(this.project_root, imported.file).replaceAll("\\", "/"),
		};
	}

	/** Responsibilities: _Python source reference mapping_. **/
	public map_source(source: LintSourceRecord): NormalizedAstFileContract {
		if (source.language !== "python") {
			return source.normalized_ast;
		}
		const imports = this.python_imports.python_imports(source.absolute_path, source.normalized_ast.python_imports);
		const class_names = new Set(source.normalized_ast.classes.map((class_node) => class_node.name));
		const call_references = source.normalized_ast.call_references.map((reference) =>
			this.map_reference(reference, imports, class_names),
		);
		return { ...source.normalized_ast, call_references };
	}
}
