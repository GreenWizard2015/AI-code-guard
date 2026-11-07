# `conditional-execution`

Description: Avoid hiding conditional non-boolean calls inside logical
operators or optional chains. `?.` skips a call when its receiver is absent;
make that execution branch explicit. Boolean calls and optional data reads
remain valid.

## Bad

```ts
// File: src/value_reporter.ts
/** Responsibilities: _optional value reporting_. **/
export class ValueReporter {
	private readonly value_loader: (() => string) | undefined;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(value_loader: (() => string) | undefined) {
		this.value_loader = value_loader;
	}
	/** Responsibilities: _optional value resolution_. **/
	public resolve_value(): string {
		return this.value_loader?.() ?? "No value supplied";
	}
	/** Responsibilities: _value status formatting_. **/
	public status_label(): string {
		return `Value: ${this.resolve_value()}`;
	}
	/** Responsibilities: _value status output_. **/
	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { ValueReporter } from "src/value_reporter";

(() => {
	const reporter = new ValueReporter(undefined);
	reporter.report();
})();
```


## Good

```ts
// File: src/value_reporter.ts
/** Responsibilities: _optional value reporting_. **/
export class ValueReporter {
	private readonly _available: boolean;
	private readonly _value: string;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(available: boolean, value: string) {
		this._available = available;
		this._value = value;
	}
	/** Responsibilities: _explicit value resolution_. **/
	public resolve_value(): string {
		if (this._available) {
			return this._value;
		}
		return "No value supplied";
	}
	/** Responsibilities: _value normalization_. **/
	public normalized_value(): string {
		const resolved = this.resolve_value();
		const trimmed = resolved.trim();
		return trimmed.toLowerCase();
	}
	/** Responsibilities: _availability labeling_. **/
	public availability_label(): string {
		if (this._available) {
			return "Availability: available";
		}
		return "Availability: missing";
	}
	/** Responsibilities: _value status formatting_. **/
	public status_label(): string {
		return `Value: ${this.normalized_value()}`;
	}
	/** Responsibilities: _report length measurement_. **/
	public label_length(): number {
		const label = this.status_label();
		return label.length;
	}
	/** Responsibilities: _value status output_. **/
	public report(): void {
		const label = this.status_label();
		const availability = this.availability_label();
		const length = this.label_length();
		console.log(`${availability} | ${label} (${length} characters)`);
	}
}
// File: cli.ts
import { ValueReporter } from "src/value_reporter";

(() => {
	const reporter = new ValueReporter(false, "");
	reporter.report();
})();
```

