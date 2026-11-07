# `method-order`

Description: Declare private and protected methods first, the constructor next, and public methods last.

## Bad

```ts
// File: src/reader.ts
export class Reader {
	public read(): string { return this.parse(); }
	public constructor() {}
	private parse(): string { return "document"; }
	public report(): void { console.log(this.read()); }
}
// File: cli.ts
import { Reader } from "src/reader";
(function () { const reader = new Reader(); reader.report(); })();
```

## Good

```ts
// File: src/domain/document_status.ts
export class DocumentStatus {
	private readonly _raw_status: string;
	private normalized_status(): string {
		const trimmed_status = this._raw_status.trim();
		const normalized_value = trimmed_status.toLowerCase();
		return normalized_value.replace(/\s+/gu, ' ');
	}
	public constructor(raw_status: string) { this._raw_status = raw_status; }
	public normalized(): string {
		const status_value = this.normalized_status();
		const words = status_value.split(/\s+/u);
		return words.join(' ');
	}
	public ready(): boolean {
		return this._raw_status.trim().replace(/\s+/gu, ' ').toLowerCase() === 'ready';
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const status_value = this.normalized_status();
		return `${clean_prefix}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const clean_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized_status();
		return status_value.includes(clean_fragment);
	}
	public report(): void {
		console.log(this.label("State"), this.ready());
	}
}
// File: cli.ts
import { DocumentStatus } from 'src/domain/document_status';
(function () {
	const status = new DocumentStatus(' READY ');
	status.normalized();
	status.contains('ead');
	status.report();
})();
```
