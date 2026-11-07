import type { NamedLine, NamedSymbol, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { NamingCandidates, NamingIndex, NamingMatches } from "src/rules/typescript/syntax-rules/types";
import type ts from "typescript";

/** Responsibilities: _per-file index caching_, _symbol and declaration matching_. **/
export class NamingIndexAnalysis {
	private readonly _indexes: WeakMap<ts.SourceFile, NamingIndex>;

	/** Responsibilities: _named symbol index_. **/
	private named_index<T extends NamedLine>(items: readonly T[]): Map<string, T[]> {
		const index = new Map<string, T[]>();
		for (const item of items) {
			const key = `${String(item.line)}:${item.name}`;
			const group = index.get(key) ?? [];
			group.push(item);
			index.set(key, group);
		}
		return index;
	}

	/** Responsibilities: _indexed symbol matches_. **/
	private indexed_symbols(
		candidates: readonly NamedLine[],
		index: ReadonlyMap<string, readonly NamedSymbol[]>,
	): NamedSymbol[] {
		const symbols: NamedSymbol[] = [];
		for (const candidate of candidates) {
			const matches = index.get(`${String(candidate.line)}:${candidate.name}`);
			if (matches !== undefined) {
				symbols.push(...matches);
			}
		}
		return symbols;
	}

	/** Responsibilities: _indexed declaration matches_. **/
	private indexed_declarations(
		candidates: readonly NamedLine[],
		index: ReadonlyMap<string, readonly NamedLine[]>,
	): NamedLine[] {
		const declarations: NamedLine[] = [];
		for (const candidate of candidates) {
			const matches = index.get(`${String(candidate.line)}:${candidate.name}`);
			if (matches !== undefined) {
				declarations.push(...matches);
			}
		}
		return declarations;
	}

	/** Responsibilities: _naming index initialization_. **/
	public constructor() {
		this._indexes = new WeakMap();
	}

	/** Responsibilities: _naming index lookup_. **/
	public index(source_file: ts.SourceFile, normalized_ast: NormalizedAstFile): NamingIndex {
		const cached = this._indexes.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const result = {
			symbols: this.named_index(normalized_ast.references.named_symbols),
			declarations: this.named_index(normalized_ast.references.type_declarations),
			classes: normalized_ast.source.classes,
		};
		this._indexes.set(source_file, result);
		return result;
	}

	/** Responsibilities: _naming candidate lookup_. **/
	public index_candidates(candidates: NamingCandidates, index: NamingIndex): NamingMatches {
		return {
			symbols: this.indexed_symbols(candidates.symbols, index.symbols),
			declarations: this.indexed_declarations(candidates.declarations, index.declarations),
		};
	}
}
