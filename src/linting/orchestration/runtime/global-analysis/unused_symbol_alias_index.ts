import type { LintSourceRecord } from "src/types";
import type { UnusedSymbolAliasCache, UnusedSymbolAliasMap } from "src/core/types";

/** Responsibilities: _source alias indexing_, _reference name expansion_. **/
export class UnusedSymbolAliasIndex {
	private readonly aliases_by_file: UnusedSymbolAliasCache;

	/** Responsibilities: _alias index initialization_. **/
	public constructor() {
		this.aliases_by_file = new Map<string, UnusedSymbolAliasMap>();
	}

	/** Responsibilities: _source alias indexing_. **/
	public add_source(source: LintSourceRecord): void {
		if (this.aliases_by_file.has(source.absolute_path)) {
			return;
		}
		const aliases = new Map<string, string>();
		for (const alias of source.normalized_ast.reference_aliases) {
			if (!aliases.has(alias.name)) {
				aliases.set(alias.name, alias.target);
			}
		}
		this.aliases_by_file.set(source.absolute_path, aliases);
	}

	/** Responsibilities: _reference binding names_. **/
	public names(source: LintSourceRecord, name: string): string[] {
		const names = [name];
		const aliases = this.aliases_by_file.get(source.absolute_path);
		if (aliases === undefined) {
			return names;
		}
		const target = aliases.get(name);
		if (target === undefined || target === name) {
			return names;
		}
		names.push(target);
		return names;
	}
}
