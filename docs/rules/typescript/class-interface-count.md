# `class-interface-count`

Description: One implementation class may implement at most three interfaces or protocols.
When a class needs more contracts, split it into focused adapters or
collaborators instead of keeping unrelated roles on one class.

## Bad

```ts
interface ReadableContract { read(): string; }
interface WritableContract { write(value: string): void; }
interface ClosableContract { close(): void; }
interface FlushableContract { flush(): void; }

class DataAdapter implements ReadableContract, WritableContract, ClosableContract, FlushableContract {
	public read(): string { return "value"; }
	public write(value: string): void { void value; }
	public close(): void {}
	public flush(): void {}
}
```


## Good

```ts
// File: src/protocols.ts
export interface TextValueContract { text(): string; }
export interface TextLengthContract { length(): number; }
export interface TextSearchContract { contains(fragment: string): boolean; }
// File: src/data_adapter.ts
import type { TextValueContract, TextLengthContract, TextSearchContract } from "src/protocols";
/** Responsibilities: _normalized text operations_. **/
export class DataAdapter implements TextValueContract, TextLengthContract, TextSearchContract {
	private readonly value_text: string;
	/** Responsibilities: _text adapter initialization_. **/
	public constructor(value: string) { this.value_text = value.trim(); }
	/** Responsibilities: _normalized text retrieval_. **/
	public text(): string {
		const normalized_text = this.value_text.trim().toUpperCase();
		return normalized_text.replace(/\s+/gu, " ");
	}
	/** Responsibilities: _normalized text length_. **/
	public length(): number {
		const normalized_text = this.value_text.toUpperCase();
		return normalized_text.length;
	}
	/** Responsibilities: _normalized text search_. **/
	public contains(fragment: string): boolean {
		const normalized_text = this.text();
		const normalized_fragment = fragment.trim().toUpperCase();
		return normalized_text.includes(normalized_fragment);
	}
}
// File: cli.ts
import { DataAdapter } from "src/data_adapter";

(function () {
	const adapter = new DataAdapter("initial value");
	console.log(adapter.text());
	console.log(adapter.length());
	console.log(adapter.contains("value"));
})();
```
