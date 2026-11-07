# `unnecessary-undefined-check`

Description: Detect a condition that checks a required field for an absent value.

**Bad:**

```ts
type Parsed = {
	attribute_accesses: string[];
};

function has_attributes(parsed: Parsed): boolean {
	return (parsed.attribute_accesses) === undefined;
}
```

Fix: Remove the check when the field is required.

The TypeScript implementation uses AST declarations and reports property or method accesses
whose declared member is required, including known array element types such as
`violations[0]?.message()` when `message` is required.

The Python implementation uses the Python AST and local class annotations. It recognizes
`is None`, `is not None`, `== None`, and `!= None` for fields declared without `Optional`,
`Union[..., None]`, or `| None`.

Unknown declarations and nullable annotations are intentionally skipped.

## Bad

```ts
// File: src/types.ts
export type ParsedValueData = {
	attribute_accesses: string[];
};
// File: src/parsed_value.ts
import type { ParsedValueData } from "src/types";

export class ParsedValue {
	private readonly parsed: ParsedValueData;
	public constructor(parsed: ParsedValueData) {
		this.parsed = parsed;
	}
	public attribute_state(parsed: ParsedValueData): string {
		if (parsed.attribute_accesses === undefined) { return "missing"; } // <- error
		return "available";
	}
	public attribute_count(): number { return this.parsed.attribute_accesses.length; }
	public contains_attribute(candidate_name: string): boolean {
		for (const attribute of this.parsed.attribute_accesses) {
			if (attribute === candidate_name) { return true; }
		}
		return false;
	}
	public attribute_preview(): string {
		const labels: string[] = [];
		for (const attribute of this.parsed.attribute_accesses) {
			labels.push(attribute.trim().toUpperCase());
		}
		return labels.join(", ");
	}
	public summary(): string {
		const state = this.attribute_state(this.parsed);
		const count = this.attribute_count();
		const preview = this.attribute_preview();
		const includes_name = this.contains_attribute("name");
		return `${state}: ${count} attributes (${preview}; name=${includes_name})`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ParsedValue } from "src/parsed_value";
(function () {
	const parsed = new ParsedValue({ attribute_accesses: ["name"] });
	parsed.report();
})();
```

## Good

```ts
// File: src/types.ts
export type ParsedValueData = {
	attribute_accesses: string[];
};
// File: src/parsed_value.ts
import type { ParsedValueData } from "src/types";

export class ParsedValue {
	private readonly _parsed: ParsedValueData;
	public constructor(parsed: ParsedValueData) {
		this._parsed = parsed;
	}
	public attribute_state(): string {
		if (this._parsed.attribute_accesses.length > 0) { return "available"; }
		return "empty";
	}
	public attribute_count(): number { return this._parsed.attribute_accesses.length; }
	public contains_attribute(candidate_name: string): boolean {
		for (const attribute of this._parsed.attribute_accesses) {
			if (attribute === candidate_name) { return true; }
		}
		return false;
	}
	public attribute_preview(): string {
		const labels: string[] = [];
		for (const attribute of this._parsed.attribute_accesses) {
			labels.push(attribute.trim().toUpperCase());
		}
		return labels.join(", ");
	}
	public summary(): string {
		const state = this.attribute_state();
		const count = this.attribute_count();
		const preview = this.attribute_preview();
		const includes_name = this.contains_attribute("name");
		return `${state}: ${count} attributes (${preview}; name=${includes_name})`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ParsedValue } from "src/parsed_value";
(function () {
	const parsed = new ParsedValue({ attribute_accesses: ["name"] });
	parsed.report();
})();
```
