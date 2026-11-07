# `class-interface-count`

Description: One implementation class may implement at most three interfaces or protocols.
When a class needs more contracts, split it into focused adapters or
collaborators instead of keeping unrelated roles on one class.

## Bad

```ts
// File: src/protocols.ts
export interface ReadableContract { read(): string; }
export interface WritableContract { write(value: string): void; }
export interface ClosableContract { close(): string; }
export interface FlushableContract { flush(): string; }
// File: src/data_adapter.ts
import type { ReadableContract, WritableContract, ClosableContract, FlushableContract } from "src/protocols";
export class DataAdapter implements ReadableContract, WritableContract, ClosableContract, FlushableContract {
	private readonly values: string[];

	public constructor(initial_value: string) {
		this.values = [initial_value];
	}

	public read(): string {
		return this.values.join(" ");
	}

	public write(value: string): void {
		this.values.push(value.trim());
	}

	public close(): string {
		return `closed after ${this.read().length} characters`;
	}

	public flush(): string {
		return this.values.join("|");
	}

	public report(): void {
		this.write("saved");
		const flushed_value = this.flush();
		console.log(`${this.read()} | ${flushed_value} | ${this.close()}`);
	}
}
// File: cli.ts
import { DataAdapter } from "src/data_adapter";
(function () {
	const adapter = new DataAdapter("initial value");
	adapter.report();
})();
```


## Good

```ts
// File: src/protocols.ts
export interface TextValueContract {
	text(): string;
	empty(): boolean;
	first_word(): string;
}
export interface TextLengthContract { length(): number; }
export interface TextSearchContract { contains(fragment: string): boolean; }
// File: src/data_adapter.ts
import type { TextValueContract, TextLengthContract, TextSearchContract } from "src/protocols";
/** Responsibilities: _normalized text operations_. **/
export class DataAdapter implements TextValueContract, TextLengthContract, TextSearchContract {
	private readonly _value_text: string;
	/** Responsibilities: _text adapter initialization_. **/
	public constructor(value: string) { this._value_text = value.trim(); }
	/** Responsibilities: _normalized text retrieval_. **/
	public text(): string {
		const normalized_text = this._value_text.trim().toUpperCase();
		return normalized_text.replace(/\s+/gu, " ");
	}
	public empty(): boolean {
		const normalized_text = this.text();
		return normalized_text.length === 0;
	}
	public first_word(): string {
		const words = this.text().split(" ");
		return words.slice(0, 1).join("");
	}
	/** Responsibilities: _normalized text length_. **/
	public length(): number {
		const normalized_text = this._value_text.toUpperCase();
		return normalized_text.length;
	}
	/** Responsibilities: _normalized text search_. **/
	public contains(fragment: string): boolean {
		const normalized_text = this.text();
		const normalized_fragment = fragment.trim().toUpperCase();
		return normalized_text.includes(normalized_fragment);
	}
	public summary(): string {
		const details = [
			this.text(),
			String(this.length()),
			String(this.contains("VALUE")),
			String(this.empty()),
			this.first_word(),
		];
		return details.join(" | ");
	}
	/** Responsibilities: _text adapter report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { DataAdapter } from "src/data_adapter";

(function () {
	const adapter = new DataAdapter("initial value");
	adapter.report();
})();
```
