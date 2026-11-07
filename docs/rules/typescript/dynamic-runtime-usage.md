# `dynamic-runtime-usage`

Description: See the examples below for the rule behavior.

### Purpose

Reflective and dynamic runtime APIs hide the contract that static analysis should be able to
resolve. This rule reports `Reflect.*`, `Proxy`, computed access through a string key, and
`key in value`, and `Object.hasOwn`/`Object.prototype.hasOwnProperty.call`, unless the right-hand side is explicitly typed as `Map`, `Set`, `WeakMap`, or
`WeakSet` in TypeScript.

### Preferred

```ts
interface ValueReader {
  read_value(): string;
}

class TypedValueReader implements ValueReader {
  private readonly target: { value: string };

  public constructor(target: { value: string }) {
    this.target = target;
  }

  public read_value(): string {
    return this.target.value;
  }
}
```

Use an explicit class, interface, or typed operation instead of reflective or dynamic runtime
access. For collection membership, use `collection.has(key)`.

## Bad

```ts
// File: src/value_reader.ts
type ValueFields = { display_name: string; status_label: string };

export class ValueProfile {
	private readonly target: ValueFields;
	private readonly key: string;
	public constructor(target: ValueFields, key: string) {
		this.target = target;
		this.key = key;
	}
	public value_text(): string {
		const key_is_known = Object.hasOwn(this.target, this.key); // <- error
		if (!key_is_known) {
			return "Unavailable";
		}
		if (this.key === "display_name") {
			return this.target.display_name.trim();
		}
		return this.target.status_label.trim();
	}
	public contains_value(): boolean {
		const value = this.value_text();
		const trimmed_value = value.trim();
		return trimmed_value.length > 0;
	}
	public report(): void {
		const value = this.value_text();
		const present = this.contains_value();
		console.log(`${value} | present=${present}`);
    }
}
// File: cli.ts
import { ValueProfile } from "src/value_reader";
(function () {
	const profile = new ValueProfile({ display_name: "Ada", status_label: "ready" }, "display_name");
	profile.report();
})();
```

`eval` and `Function` are allowed by this rule.

## Good

```ts
// File: src/profile_summary.ts
export class ProfileSummary {
	private readonly _given_name: string;
	private readonly _family_name: string;
	private readonly _status_history: string[];
	public constructor(given_name: string, family_name: string, status_code: string) {
		this._given_name = given_name;
		this._family_name = family_name;
		this._status_history = [status_code];
	}
	public normalized_name(): string {
		const given_name = this._given_name.normalize("NFC").trim();
		const family_name = this._family_name.normalize("NFC").trim();
		const complete_name = `${given_name} ${family_name}`;
		return complete_name.replace(/\s+/gu, " ");
	}
	public change_status(status_code: string): void {
		this._status_history.push(status_code);
	}
	public status_text(): string {
		let status_code = "";
		for (const history_entry of this._status_history) {
			status_code = history_entry;
		}
		return status_code.trim().replace(/_/gu, " ").toUpperCase();
	}
	public summary(): string {
		const name = this.normalized_name();
		const status = this.status_text();
		return `${name} | ${status}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ProfileSummary } from "src/profile_summary";
(function () {
	const summary = new ProfileSummary("Ada", "Lovelace", "draft");
	summary.change_status("ready_for_review");
	summary.report();
})();
```
