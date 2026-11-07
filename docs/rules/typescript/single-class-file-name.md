# single-class-file-name

Description: Keep a production file containing exactly one implementation class named `MyClass` in the sibling file `my_class.ts` or `my_class.py`. Convert the complete class name to snake_case for both TypeScript and Python. Kebab-case names such as `my-class.ts` are forbidden.

Test files and facade files (`index.ts`, `index.py`, and `__init__.py`) are not renamed by this rule.

## Bad

```ts
// File: src/record.ts
export class RecordIdentifier {
	private readonly value_text: string;
	public constructor(value: string) { this.value_text = value.trim(); }
	public value(): string { return this.with_prefix(""); }
	public matches_prefix(prefix: string): boolean { return this.value_text.startsWith(`${prefix}:`); }
	public with_prefix(prefix: string): string {
		if (prefix.length === 0) { return this.value_text; }
		if (this.matches_prefix(prefix)) { return this.value_text; }
		const prefixed = new RecordIdentifier(`${prefix}:${this.value_text}`);
		return prefixed.value();
	}
	public report(): void { console.log(this.value()); }
}
// File: src/cli.ts
import { RecordIdentifier } from "src/record";
(function () {
	const identifier = new RecordIdentifier("order-42");
	identifier.report();
})();
```


## Good

```ts
// File: src/record_identifier.ts
/** Responsibilities: _record identity_, _prefix normalization_. **/
export class RecordIdentifier {
	private readonly _prefixed_values: Map<string, string>;
	private readonly _value_text: string;

	/** Responsibilities: _initial identity_. **/
	public constructor(value: string) {
		this._value_text = value.trim();

		this._prefixed_values = new Map();}

	/** Responsibilities: _identity view_. **/
	public value(): string {
		return this.with_prefix("");
	}

	/** Responsibilities: _prefix comparison_. **/
	public matches_prefix(prefix: string): boolean {
		return this._value_text.startsWith(`${prefix}:`);
	}

	/** Responsibilities: _prefix identity_. **/
	public with_prefix(prefix: string): string {
		const cached = this._prefixed_values.get(prefix);
		if (cached !== undefined) { return cached; }
		if (prefix.length === 0) {
			this._prefixed_values.set(prefix, this._value_text);
			return this._value_text;
		}
		if (this.matches_prefix(prefix)) {
			this._prefixed_values.set(prefix, this._value_text);
			return this._value_text;
		}
		const prefixed = new RecordIdentifier(`${prefix}:${this._value_text}`);
		const value = prefixed.value();
		this._prefixed_values.set(prefix, value);
		return value;
	}
	/** Responsibilities: _identity reporting_. **/
	public report(): void {
		console.log(this.value());
	}
}
// File: src/cli.ts
import { RecordIdentifier } from "src/record_identifier";
(function () {
	const identifier = new RecordIdentifier("order-42");
	identifier.report();
})();
```
