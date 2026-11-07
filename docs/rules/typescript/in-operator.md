# `in-operator`

Description: See the examples below for the rule behavior.

### Purpose

Do not use `if (key in value)` for ordinary object membership checks. The operator hides
whether the code is checking an own property, an inherited property, or a collection key.

### Preferred

```ts
if (options.has(name)) {
	return options.get(name);
}
```

The rule allows the right-hand side only when its annotation resolves to a built-in `Map`,
`Set`, `WeakMap`, or `WeakSet` (including read-only variants). A local type with one of
those names is not a collection. Use the collection's named API for membership.

## Bad

```ts
// File: src/option_reader.ts
export class OptionReader {
	private readonly options: Record<string, string>;
	public constructor(options: Record<string, string>) {
		this.options = options;
	}
	public contains_name(): boolean {
		const name_exists = "name" in this.options; // <- error
		if (!name_exists) {
			return false;
		}
		const value = this.options["name"];
		return value.trim().length > 0;
	}
	public name_text(): string {
		const value = this.options["name"];
		if (value === undefined) {
			return "";
		}
		return value.trim();
	}
	public report(): string {
		const output = this.contains_name() ? this.name_text() : "missing";
		console.log(output);
		return output;
	}
}
// File: cli.ts
import { OptionReader } from "src/option_reader";
(function () {
	const reader = new OptionReader({ name: "Ada" });
	reader.report();
})();
```

## Good

```ts
// File: src/option_index.ts
export class OptionIndex {
	private readonly _options: ReadonlyMap<string, string>;
	private readonly _allowed_names: ReadonlySet<string>;
	public constructor(options: ReadonlyMap<string, string>, allowed_names: ReadonlySet<string>) {
		this._options = options;
		this._allowed_names = allowed_names;
	}
	public name_text(name: string): string {
		if (!this._options.has(name)) {
			return "";
		}
		const value = this._options.get(name);
		if (value === undefined) {
			return "";
		}
		return value;
	}
	public name_allowed(name: string): boolean {
		const is_allowed = this._allowed_names.has(name);
		if (!is_allowed) {
			return false;
		}
		return true;
	}
	public report(): string {
		const value = this.name_text("name");
		const allowed = String(this.name_allowed(value));
		const output = `${value} | ${allowed}`;
		console.log(output);
		return output;
	}
}
// File: cli.ts
import { OptionIndex } from "src/option_index";
(function () {
	const values = new Map<string, string>([["name", "Ada"]]);
	const allowed_names = new Set<string>(["Ada"]);
	const options = new OptionIndex(values, allowed_names);
	options.report();
})();
```
