import type { AstLanguage, NamedLine, NormalizedAstSymbolReferences } from "src/model/ast/normalized_ast_types";
import type { CachedAstSourceContract } from "src/source_protocols";

/** Responsibilities: _cached AST reference collections_, _type member declaration relationships_. **/
export class CachedAstReferences {
	private readonly _references: NormalizedAstSymbolReferences;
	private readonly _source: CachedAstSourceContract;

	/** Responsibilities: _cached type-member validation_. **/
	private type_members_valid(): boolean {
		for (const [name, members] of this._references.type_members) {
			if (typeof name !== "string") {
				return false;
			}
			for (const [member_name, member_type] of members) {
				if (typeof member_name !== "string" || typeof member_type !== "string") {
					return false;
				}
			}
		}
		return true;
	}

	/** Responsibilities: _cached reference initialization_. **/
	public constructor(references: NormalizedAstSymbolReferences, source: CachedAstSourceContract) {
		this._references = references;
		this._source = source;
	}

	/** Responsibilities: _cached reference arrays_. **/
	public arrays_valid(): boolean {
		const arrays = [
			this._references.attribute_accesses,
			this._references.symbol_references,
			this._references.literal_references,
			this._references.literal_constants,
			this._references.named_symbols,
			this._references.type_declarations,
			this._references.reference_aliases,
		];
		return arrays.every(Array.isArray);
	}

	/** Responsibilities: _cached declaration references_. **/
	public declarations_valid(language: AstLanguage): boolean {
		if (!this.type_members_valid()) {
			return false;
		}
		if (!this._references.type_declarations.every((value: NamedLine) => this._source.named_line_valid(value))) {
			return false;
		}
		return this._source.declarations_valid(language);
	}
}
