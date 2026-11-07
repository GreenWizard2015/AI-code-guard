# `object-prototype-string`

Description: Prototype inspection is a weak type contract.

```ts
Object.prototype.toString.call(value)
```


Fix: Use a named type guard or an explicit value check.

## Bad

```ts
// File: src/value_label.ts
/** Responsibilities: _value type label_, _prefixed label composition_, _label reporting_. **/
export class ValueLabel {
	private readonly value: string;
	private readonly prefix: string;
	/** Responsibilities: _value classifier initialization_. **/
	public constructor(prefix: string, value: string) {
		this.prefix = prefix;
		this.value = value;
	}
	/** Responsibilities: _value type classification_. **/
	public type_label(): string {
		return Object.prototype.toString.call(this.value); // <- error
	}
	/** Responsibilities: _value label composition_. **/
	public label(): string {
		return `${this.prefix.trim()}: ${this.type_label()} ${this.value.trim()}`;
	}
	/** Responsibilities: _uppercase label composition_. **/
	public uppercase_label(): string {
		return this.label().toUpperCase();
	}
	/** Responsibilities: _classification output_. **/
	public report(): void {
		console.log([this.label(), this.uppercase_label()].join(" | "));
	}
}
// File: cli.ts
import { ValueLabel } from "src/value_label";
(function () {
	const value_label = new ValueLabel("State", "ready");
	value_label.report();
})();
```

## Good

```ts
// File: src/value_label.ts
/** Responsibilities: _value type label_, _prefixed label composition_, _label reporting_. **/
export class ValueLabel {
	private readonly _value: string;
	private readonly _prefix: string;
	/** Responsibilities: _value classifier initialization_. **/
	public constructor(prefix: string, value: string) {
		this._prefix = prefix;
		this._value = value;
	}
	/** Responsibilities: _value type classification_. **/
	public type_label(): string {
		return "string";
	}
	/** Responsibilities: _value label composition_. **/
	public label(): string {
		if (this._prefix.trim().length === 0) {
			return `${this.type_label()} ${this._value.trim()}`;
		}
		return `${this._prefix.trim()}: ${this.type_label()} ${this._value.trim()}`;
	}
	/** Responsibilities: _uppercase label composition_. **/
	public uppercase_label(): string {
		return this.label().toUpperCase();
	}
	/** Responsibilities: _classification output_. **/
	public report(): void {
		console.log([this.label(), this.uppercase_label()].join(" | "));
	}
}
// File: cli.ts
import { ValueLabel } from "src/value_label";
(function () {
	const value_label = new ValueLabel("State", "ready");
	value_label.report();
})();
```
