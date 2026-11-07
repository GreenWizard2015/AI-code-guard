# `large-union`

Description: Too many alternatives make a value contract ambiguous.

```ts
type Result = A | B | C | D;
```

Python annotations with the same number of alternatives are also reported:


Fix: Introduce a focused discriminated type or protocol.

## Bad

```ts
// File: src/types.ts
export type Result = string | number | boolean | bigint;
// File: src/result_reporter.ts
import type { Result } from "src/types";
export class ResultReporter {
	private readonly prefix: string;
	private readonly value: Result;
	public constructor(prefix: string, value: Result) {
		this.prefix = prefix;
		this.value = value;
	}
	public format_result(): string {
		const raw_value = String(this.value).trim();
		if (raw_value.length === 0) {
			return "";
		}
		const words = raw_value.split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) {
				normalized_words.push(word);
			}
		}
		return normalized_words.join(" ");
	}
	public empty(): boolean {
		const formatted = this.format_result();
		if (formatted.length === 0) {
			return true;
		}
		return formatted.trim().length === 0;
	}
	public report(): void {
		if (this.empty()) {
			return;
		}
		const formatted = this.format_result();
		const output = `${this.prefix.trim()}: ${formatted}`;
		console.log(output);
	}
}
// File: cli.ts
import { ResultReporter } from "src/result_reporter";
(function () {
	const reporter = new ResultReporter("Result", "first");
	reporter.report();
})();
```


## Good

```ts
// File: src/types.ts
export type Item = string;
// File: src/result_reporter.ts
import type { Item } from "src/types";
export class ResultReporter {
	private readonly _prefix: string;
	private readonly _value: Item;
	public constructor(prefix: string, value: Item) {
		this._prefix = prefix;
		this._value = value;
	}
	public format_result(): string {
		const raw_value = this._value.trim();
		if (raw_value.length === 0) {
			return "";
		}
		const words = raw_value.split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) {
				normalized_words.push(word);
			}
		}
		return normalized_words.join(" ");
	}
	public empty(): boolean {
		const formatted = this.format_result();
		if (formatted.length === 0) {
			return true;
		}
		return formatted.trim().length === 0;
	}
	public report(): void {
		if (this.empty()) {
			return;
		}
		const formatted = this.format_result();
		const output = `${this._prefix.trim()}: ${formatted}`;
		console.log(output);
	}
}
// File: cli.ts
import type { Item } from "src/types";
import { ResultReporter } from "src/result_reporter";
(function () {
	const item: Item = "one";
	const reporter = new ResultReporter("Item", item);
	reporter.report();
})();
```

