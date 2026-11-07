# `nullable-domain-type`

Description: Do not use `null`, `undefined`, `None`, `Optional`, `Any`, `unknown`, `void`,
or `never` at a field, parameter, or return boundary. Model meaningful absence
with an explicit domain contract instead of a nullable value.

## Bad

```ts
// File: src/label_text.ts
export class LabelText {
	private readonly value: string | null;
	public constructor(value: string | null) {
		this.value = value;
	}
	public normalized_text(): string {
		if (this.value === null) {
			return "unavailable";
		}
		const trimmed = this.value.trim();
		if (trimmed.length === 0) {
			return "(empty)";
		}
		const words = trimmed.split(/\s+/u);
		return words.join(" ");
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const text = this.normalized_text();
		if (clean_prefix.length === 0) {
			return text;
		}
		return `${clean_prefix}: ${text}`;
	}
	public report(): string {
		const output = this.label("Label");
		console.log(output);
		return output;
	}
}
// File: cli.ts
import { LabelText } from "src/label_text";
(function () {
	const label = new LabelText(null);
	label.report();
})();
```


If absence is a real state, define an interface or protocol for the shared
behavior and distinct classes for each state. Keep the serialized boundary
representation local to the adapter that communicates with an external system.

## Good

```ts
// File: src/label_text.ts
export class LabelText {
	private readonly _normalized_cache: Map<string, string>;
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;

		this._normalized_cache = new Map();}
	public normalized_text(): string {
		const cached = this._normalized_cache.get(this._value);
		if (cached !== undefined) { return cached; }
		const trimmed = this._value.trim();
		if (trimmed.length === 0) {
			this._normalized_cache.set(this._value, "(empty)");
			return "(empty)";
		}
		const normalized = trimmed.split(/\s+/u).join(" ");
		this._normalized_cache.set(this._value, normalized);
		return normalized;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const text = this.normalized_text();
		if (clean_prefix.length === 0) {
			return text;
		}
		return `${clean_prefix}: ${text}`;
	}
	public report(): string {
		const output = this.label("Label");
		console.log(output);
		return output;
}
}
// File: cli.ts
import { LabelText } from "src/label_text";
(function () {
	const label = new LabelText("ready");
	label.report();
})();
```

