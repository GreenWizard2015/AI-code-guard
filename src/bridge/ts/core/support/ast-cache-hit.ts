import type { AstCacheEntry } from 'src/bridge/ts/core/support/protocols';
import type { AstLanguage, NormalizedAstFile } from 'src/types';

/** Responsibilities: _cached AST ownership_, _cached language matching_. **/
export class AstCacheHit implements AstCacheEntry {
	private readonly cached_ast: NormalizedAstFile;

	/** Responsibilities: _cache identity shape_. **/
	private identity_arrays(): boolean {
		const arrays = [
			this.cached_ast.classes,
			this.cached_ast.functions,
			this.cached_ast.parse_issues,
			this.cached_ast.import_issues,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cache data shape_. **/
	private data_arrays(): boolean {
		const arrays = [
			this.cached_ast.attribute_accesses,
			this.cached_ast.named_symbols,
			this.cached_ast.type_declarations,
			this.cached_ast.reference_aliases,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cache optional data shape_. **/
	private optional_data_arrays(): boolean {
		const arrays = [
			this.cached_ast.private_accesses,
			this.cached_ast.repeated_branches,
			this.cached_ast.call_references,
			this.cached_ast.module_instances,
			this.cached_ast.module_constant_spans,
			this.cached_ast.module_type_spans,
			this.cached_ast.module_protocol_spans,
			this.cached_ast.coding_issues,
			this.cached_ast.python_imports,
			this.cached_ast.docstring_spans,
			this.cached_ast.responsibility_targets,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cached AST state initialization_. **/
	public constructor(ast: NormalizedAstFile) {
		this.cached_ast = ast;
	}

	/** Responsibilities: _cached AST presence reporting_. **/
	public present(): boolean {
		return true;
	}

	/** Responsibilities: _cached AST value_. **/
	public value(): NormalizedAstFile {
		if (!this.complete()) {
			throw new Error('AST cache entry is invalid.');
		}
		return this.cached_ast;
	}

	/** Responsibilities: _cache shape_. **/
	public complete(): boolean {
		if (this.cached_ast.language !== 'python') {
			if (this.cached_ast.language !== 'typescript') {
				return false;
			}
		}
		if (!this.identity_arrays()) {
			return false;
		}
		if (!this.data_arrays()) {
			return false;
		}
		return this.optional_data_arrays();
	}

	/** Responsibilities: _cached AST reuse decision_. **/
	public should_reparse(): boolean {
		return false;
	}

	/** Responsibilities: _cached AST language matching_. **/
	public supports_language(language: AstLanguage): boolean {
		return this.cached_ast.language === language;
	}
}
