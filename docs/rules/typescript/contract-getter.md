# TypeScript contract getters

Description: TypeScript interfaces declare behavior with methods. Do not declare
`get` accessors in an interface; express the operation as a method instead.

## Bad

```ts
// File: src/source_reader.ts
export interface SourceContract { // <- error
	get path(): string;
}
/** Responsibilities: _source path reporting_. **/
export class SourceReader implements SourceContract {
	private readonly source_path: string;
	/** Responsibilities: _reader initialization_. **/
	public constructor(source_path: string) {
		this.source_path = source_path;
	}
	public get path(): string {
		return this.source_path.trim();
	}
	/** Responsibilities: _source report output_. **/
	public report(): void {
		console.log(`Source: ${this.path}`);
	}
}
// File: cli.ts
import { SourceReader } from "src/source_reader";

(() => {
	const reader = new SourceReader("/messages/current");
	reader.report();
})();
```

## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _source document behavior contract_. **/
export interface SourceDocumentContract {
	normalized_location(): string;
	source_label(): string;
	local(): boolean;
	location_length(): number;
}
// File: src/source_document.ts
import type { SourceDocumentContract } from "src/protocols";

/** Responsibilities: _source document identity and status_. **/
export class SourceDocument implements SourceDocumentContract {
	private readonly _source_location: string;
	private readonly _source_kind: string;
	public constructor(source_location: string, source_kind: string) {
		this._source_location = source_location;
		this._source_kind = source_kind;
	}
	public normalized_location(): string {
		const trimmed_location = this._source_location.trim();
		const normalized_location = trimmed_location.toLowerCase();
		if (normalized_location.length === 0) {
			return "unknown location";
		}
		return normalized_location;
	}
	public source_label(): string {
		const location = this.normalized_location();
		const kind = this._source_kind.trim().toLowerCase();
		if (kind.length === 0) {
			return `Source: ${location}`;
		}
		return `${kind}: ${location}`;
	}
	public local(): boolean {
		const kind = this._source_kind.trim().toLowerCase();
		return kind === "local";
	}
	public location_length(): number {
		const location = this.normalized_location();
		return location.length;
	}
	public report(): void {
		const label = this.source_label();
		const local_source = this.local();
		const location_size = this.location_length();
		const line = `${label} | local=${local_source} | length=${location_size}`;
		console.log(line);
	}
}
// File: cli.ts
import { SourceDocument } from "src/source_document";

(() => {
	const document = new SourceDocument("/messages/current", "local");
	document.report();
})();
```
