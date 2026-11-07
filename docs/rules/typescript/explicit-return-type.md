# `explicit-return-type`

Description: Declare the result type of every named callable explicitly.

## Bad

```ts
// File: src/read_value.ts
/** Responsibilities: _text value state_. **/
export class ReadValue {
	private readonly raw_value: string;

	/** Responsibilities: _value initialization_. **/
	public constructor(raw_value: string) {
		this.raw_value = raw_value;
	}

	/** Responsibilities: _value normalization_. **/
	public normalized_value(): string {
		const trimmed = this.raw_value.trim();
		const words = trimmed.split(/\s+/u);
		const joined = words.join(" ");
		const normalized = joined.toLowerCase();
		return normalized;
	}

	/** Responsibilities: _normalized word counting_. **/
	public word_count(): number {
		const words = this.normalized_value().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _value reading_. **/
	public render_value() { // <- error
		const value = this.normalized_value();
		const count = this.word_count();
		const rendered = `${value} (${count})`;
		console.log(rendered);
		return rendered;
	}
}
// File: cli.ts
import { ReadValue } from "src/read_value";

(function () {
	const value = new ReadValue("ready");
	value.render_value();
})();
```

## Good

```ts
// File: src/read_value.ts
/** Responsibilities: _text value state_. **/
export class ReadValue {
	private readonly _raw_value: string;

	/** Responsibilities: _value initialization_. **/
	public constructor(raw_value: string) {
		this._raw_value = raw_value;
	}

	/** Responsibilities: _value normalization_. **/
	public normalized_value(): string {
		const trimmed = this._raw_value.trim();
		const words = trimmed.split(/\s+/u);
		const joined = words.join(" ");
		const normalized = joined.toLowerCase();
		return normalized;
	}

	/** Responsibilities: _normalized word counting_. **/
	public word_count(): number {
		if (this._raw_value.trim().length === 0) {
			return 0;
		}
		const words = this.normalized_value().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _value reading_. **/
	public render_value(): string {
		const value = this.normalized_value();
		const count = this.word_count();
		const rendered = `${value} (${count})`;
		console.log(rendered);
		return rendered;
	}
}
// File: cli.ts
import { ReadValue } from "src/read_value";

(function () {
	const value = new ReadValue("ready");
	value.render_value();
})();
```
