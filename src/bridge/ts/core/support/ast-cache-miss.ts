import type { AstCacheEntry } from 'src/bridge/ts/core/support/protocols';
import type { AstLanguage, NormalizedAstFile } from 'src/types';

/** Responsibilities: _missing AST ownership_, _cache miss language rejection_. **/
export class AstCacheMiss implements AstCacheEntry {
	private readonly source_file: string;
	private readonly reason: string;

	/** Responsibilities: _missing AST source tracking_, _cache miss reason tracking_. **/
	public constructor(source_file: string, reason: string) {
		this.source_file = source_file;
		this.reason = reason;
	}

	/** Responsibilities: _missing AST presence reporting_. **/
	public present(): boolean {
		return false;
	}

	/** Responsibilities: _missing AST access rejection_. **/
	public value(): NormalizedAstFile {
		throw new Error(`AST cache entry is missing for ${this.source_file}: ${this.reason}`);
	}

	/** Responsibilities: _missing AST completeness reporting_. **/
	public complete(): boolean {
		return false;
	}

	/** Responsibilities: _cache miss reparsing decision_. **/
	public should_reparse(): boolean {
		return true;
	}

	/** Responsibilities: _missing AST language rejection_. **/
	public supports_language(_language: AstLanguage): boolean {
		return false;
	}
}
