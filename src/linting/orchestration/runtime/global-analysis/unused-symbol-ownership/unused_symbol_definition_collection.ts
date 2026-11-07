import type { UnusedSymbolDefinition } from "src/core/types";

/** Responsibilities: _definition storage_, _duplicate suppression_. **/
export class UnusedSymbolDefinitionCollection {
	private readonly _entries: UnusedSymbolDefinition[];
	private readonly _identities: Set<string>;

	/** Responsibilities: _collection initialization_. **/
	public constructor() {
		this._entries = [];
		this._identities = new Set();
	}

	/** Responsibilities: _unique definition addition_. **/
	public append(definition: UnusedSymbolDefinition): void {
		const identity = `${definition.file}:${definition.line}:${definition.kind}:${definition.owner}:${definition.owner_kind}:${definition.name}`;
		if (this._identities.has(identity)) {
			return;
		}
		this._identities.add(identity);
		this._entries.push(definition);
	}

	/** Responsibilities: _definition access_. **/
	public all(): UnusedSymbolDefinition[] {
		return [...this._entries];
	}
}
