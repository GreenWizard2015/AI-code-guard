# `prototype-assignment`

Description: Prototype mutation obscures class ownership and invariants.

```ts
User.prototype.load = function () { /* ... */ };
```


Fix: Declare `class User` and place `load()` in its body.

## Bad

```ts
// File: src/user.ts
export class User {
	public declare load: () => string;
	public report(): void {
		console.log(this.load());
	}
}
User.prototype.load = function (): string {
	return "ready";
};
// File: cli.ts
import { User } from "src/user";
(function () {
	const user = new User();
	user.report();
})();
```

## Good

```ts
// File: src/user.ts
export class User {
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
	}
	public normalized_value(): string {
		const trimmed = this._value.trim();
		if (this._value.trim().length === 0) {
			return "unavailable";
		}
		const words = trimmed.split(/\s+/u);
		return words.join(" ");
	}
	public ready(): boolean {
		const loaded_value = this.normalized_value();
		return loaded_value.toLowerCase() === "ready";
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const loaded_value = this.normalized_value();
		if (clean_prefix.length === 0) {
			return loaded_value;
		}
		return `${clean_prefix}: ${loaded_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return this.normalized_value().toLowerCase().includes(normalized_fragment);
	}
	public report(): string {
		const fields = [
			this.normalized_value(),
			String(this.ready()),
			this.label("User"),
			String(this.contains("ead")),
		];
		const output = fields.join(" | ");
		console.log(output);
		return output;
	}
}
// File: cli.ts
import { User } from "src/user";
(function () {
	const user = new User("ready");
	user.report();
})();
```
