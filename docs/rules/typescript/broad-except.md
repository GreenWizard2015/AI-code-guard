# `broad-except`

Description: Broad catches hide unrelated programming failures.

TypeScript catches without a specific error boundary are also reported.

Fix: Catch only the expected exception at the I/O, network, process, or JSON boundary.

## Bad

```ts
// File: src/resource_label.ts
export class ResourceLabel {
	private readonly encoded_value: string;
	public constructor(encoded_value: string) {
		this.encoded_value = encoded_value;
	}
	public normalized_value(): string {
		try {
			return decodeURIComponent(this.encoded_value);
		} catch {
			return "unavailable";
		}
	}
	public available(): boolean {
		const normalized_value = this.normalized_value();
		return normalized_value.length > 0;
	}
	public normalized_word_count(): number {
		const words = this.normalized_value().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const value = this.normalized_value();
		const available = this.available();
		console.log(`${value} | ${available} | ${this.normalized_word_count()} words`);
	}
}
// File: cli.ts
import { ResourceLabel } from "src/resource_label";
(function () {
	const label = new ResourceLabel("bad%ZZlabel");
	label.report();
})();
```

## Good

```ts
// File: src/resource_label.ts
export class ResourceLabel {
	private readonly _encoded_value: string;
	public constructor(encoded_value: string) {
		this._encoded_value = encoded_value;
	}
	public normalized_value(): string {
		return decodeURIComponent(this._encoded_value);
	}
	public available(): boolean {
		return decodeURIComponent(this._encoded_value).length > 0;
	}
	public normalized_word_count(): number {
		const words = this.normalized_value().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const value = this.normalized_value();
		const available = this.available();
		console.log(`${value} | ${available} | ${this.normalized_word_count()} words`);
	}
}
// File: cli.ts
import { ResourceLabel } from "src/resource_label";
(function () {
	const label = new ResourceLabel("ready%20state");
	label.report();
})();
```
