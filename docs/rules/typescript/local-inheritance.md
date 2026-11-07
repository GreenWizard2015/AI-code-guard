# `local-inheritance`

Description: A class may extend only a project contract and may implement only a declared contract. A type alias is not a contract. An interface may extend only another interface. Compose implementation objects instead of inheriting their behavior.

## Bad

```ts
// File: src/reader.ts
export class ReaderBase {
	public read(): string {
		return "ready";
	}

	public report(): void {
		const content = this.read();
		console.log(content);
	}
}

export class CachedReader extends ReaderBase {} // <- error
export interface ReaderContract extends ReaderBase {} // <- error
export type ReaderShape = { read(): string };
export class ShapedReader implements ReaderShape {
	public read(): string {
		return "shaped";
	}
} // <- error
// File: cli.ts
import { CachedReader } from "src/reader";

(function run(): void {
	const reader = new CachedReader();
	reader.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface ContentCatalogContract {
	content_for(key: string): string;
	content_count(): number;
}
export interface ExtendedContentCatalogContract extends ContentCatalogContract {
	content_keys(): readonly string[];
}
// File: src/content_catalog.ts
import type { ExtendedContentCatalogContract } from "src/protocols";
/** Responsibilities: _content lookup and catalog reporting_. **/
export class ContentCatalog implements ExtendedContentCatalogContract {
	private readonly _records: ReadonlyMap<string, string>;
	/** Responsibilities: _catalog initialization_. **/
	public constructor(records: ReadonlyMap<string, string>) {
		this._records = records;
	}
	/** Responsibilities: _content selection_. **/
	public content_for(key: string): string {
		const content = this._records.get(key);
		if (content === undefined) { return ""; }
		return content.trim();
	}
	/** Responsibilities: _catalog content count_. **/
	public content_count(): number {
		let count = 0;
		for (const content of this._records.values()) {
			if (content.length > 0) { count += 1; }
		}
		return count;
	}
	/** Responsibilities: _catalog key selection_. **/
	public content_keys(): readonly string[] {
		const keys: string[] = [];
		for (const key of this._records.keys()) {
			if (key.length > 0) { keys.push(key); }
		}
		return keys;
	}
	/** Responsibilities: _catalog overview reporting_. **/
	public report(): void {
		const content = this.content_for("ready");
		const count = this.content_count();
		const keys = this.content_keys().join(",");
		console.log(`${content}; ${count} entries; keys=${keys}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { ContentCatalog } from "src/content_catalog";
(function () {
	const records = new Map<string, string>([["ready", "ready"]]);
	const catalog = new ContentCatalog(records);
	catalog.report();
})();
```
