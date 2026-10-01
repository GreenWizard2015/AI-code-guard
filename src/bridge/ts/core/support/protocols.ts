import type { AstLanguage, NormalizedAstFile } from "src/types";

/** Responsibilities: _cached AST state contract_, _language compatibility_. **/
export interface AstCacheEntry {
	present(): boolean;
	value(): NormalizedAstFile;
	complete(): boolean;
	should_reparse(): boolean;
	supports_language(language: AstLanguage): boolean;
}
