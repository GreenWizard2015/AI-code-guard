import type { PythonCollaboratorFileContextContract } from "src/linting/orchestration/runtime/python/python_collaborator_types";
import type {
	AstCallableReference,
	AstClassNode,
	NormalizedAstSource,
	NormalizedAstSymbolReferences,
} from "src/model/ast/normalized_ast_types";
import type { ImportedSymbol } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { PythonLintInput } from "src/types";

/** Responsibilities: _per-file collaborator analysis state_, _module variable ownership_. **/
export class PythonCollaboratorFileAnalysis implements PythonCollaboratorFileContextContract {
	private readonly _input_value: PythonLintInput;
	private readonly _imports_value: ReadonlyMap<string, ImportedSymbol>;
	private readonly _module_variable_names: Set<string>;
	private readonly _violation_list: ViolationContract[];
	private readonly _reported_line_numbers: Set<number>;
	private readonly _class_nodes: readonly AstClassNode[];
	private readonly _callable_references: readonly AstCallableReference[];
	private readonly _declarations: NormalizedAstSource;
	private readonly _references: NormalizedAstSymbolReferences;

	/** Responsibilities: _per-file collaborator input setup_. **/
	public constructor(input: PythonLintInput, imports: ReadonlyMap<string, ImportedSymbol>) {
		this._input_value = input;
		this._imports_value = imports;
		this._module_variable_names = new Set<string>();
		this._violation_list = [];
		this._reported_line_numbers = new Set<number>();
		this._declarations = input.normalized_ast.source;
		this._class_nodes = this._declarations.classes;
		this._references = input.normalized_ast.references;
		this._callable_references = this._references.call_references;
	}

	/** Responsibilities: _collaborator input_. **/
	public input(): PythonLintInput {
		return this._input_value;
	}

	/** Responsibilities: _imported collaborators_. **/
	public imports(): ReadonlyMap<string, ImportedSymbol> {
		return this._imports_value;
	}

	/** Responsibilities: _module variable names_. **/
	public module_variables(): ReadonlySet<string> {
		return this._module_variable_names;
	}

	/** Responsibilities: _collaborator violations_. **/
	public violations(): ViolationContract[] {
		return this._violation_list;
	}

	/** Responsibilities: _reported source lines_. **/
	public reported_lines(): Set<number> {
		return this._reported_line_numbers;
	}

	/** Responsibilities: _class declarations_. **/
	public classes(): readonly AstClassNode[] {
		return this._class_nodes;
	}

	/** Responsibilities: _call references_. **/
	public call_references(): readonly AstCallableReference[] {
		return this._callable_references;
	}

	/** Responsibilities: _module variable ownership indexing_. **/
	public prepare(): void {
		for (const symbol of this._references.named_symbols) {
			if (symbol.is_module_variable === true) {
				this._module_variable_names.add(symbol.name);
			}
		}
	}
}
