import { CachedAstReferences } from "src/core/cache/ast-disk-cache/cached_ast_references";
import { CachedAstSource } from "src/core/cache/ast-disk-cache/cached_ast_source";
import type {
	AstLanguage,
	NormalizedAstControlFlow,
	NormalizedAstFile,
	NormalizedAstModuleDeclarations,
} from "src/model/ast/normalized_ast_types";
import type { AstCacheEntryContract } from "src/source_protocols";

/** Responsibilities: _cached AST ownership_, _cached language matching_. **/
export class AstCacheHit implements AstCacheEntryContract {
	private readonly _cached_ast: NormalizedAstFile;
	private readonly _cached_source: CachedAstSource;
	private readonly _cached_references: CachedAstReferences;
	private readonly _control_flow: NormalizedAstControlFlow;
	private readonly _module_declarations: NormalizedAstModuleDeclarations;

	/** Responsibilities: _cache optional data shape_. **/
	private optional_data_arrays(): boolean {
		const arrays = [
			this._control_flow.private_accesses,
			this._control_flow.repeated_branches,
			this._cached_ast.references.call_references,
			this._control_flow.module_instances,
			this._module_declarations.module_constant_spans,
			this._module_declarations.module_type_spans,
			this._module_declarations.module_protocol_spans,
			this._cached_ast.source.coding_issues,
			this._cached_ast.source.python_imports,
			this._module_declarations.docstring_spans,
			this._module_declarations.responsibility_targets,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cached AST state initialization_. **/
	public constructor(ast: NormalizedAstFile) {
		this._cached_ast = ast;
		this._cached_source = new CachedAstSource(ast.source);
		this._cached_references = new CachedAstReferences(ast.references, this._cached_source);
		this._control_flow = ast.control_flow;
		this._module_declarations = ast.module_declarations;
	}

	/** Responsibilities: _cached AST presence reporting_. **/
	public present(): boolean {
		return true;
	}

	/** Responsibilities: _cached AST value_. **/
	public value(): NormalizedAstFile {
		if (!this.complete()) {
			throw new Error("AST cache entry is invalid.");
		}
		return this._cached_ast;
	}

	/** Responsibilities: _cache shape_. **/
	public complete(): boolean {
		if (!this._cached_source.supported_language()) {
			return false;
		}
		if (!this._cached_source.arrays_valid()) {
			return false;
		}
		if (!this._cached_references.arrays_valid()) {
			return false;
		}
		if (!this.optional_data_arrays()) {
			return false;
		}
		return this._cached_references.declarations_valid(this._cached_ast.source.language);
	}

	/** Responsibilities: _cached AST reuse decision_. **/
	public should_reparse(): boolean {
		return false;
	}

	/** Responsibilities: _cached AST language matching_. **/
	public supports_language(language: AstLanguage): boolean {
		return this._cached_ast.source.language === language;
	}
}
