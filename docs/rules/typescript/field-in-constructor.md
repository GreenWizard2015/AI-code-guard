# `field-in-constructor`

Description: Keep simple scalar literals as field defaults. Initialize collections,
constructed objects, and computed field values in the constructor. This applies
to TypeScript instance fields and Python constructor or factory calls in class
fields.

```ts
class ImportResolver {
	private readonly extensions = [".ts", ".tsx"];
	private readonly cache_enabled = process.env[NODE_ENV_VARIABLE] !== "test";
}
```

Declare each field without an initializer, then assign it in `constructor`,
`__init__`, or `__post_init__`.

## Bad

```ts
// File: src/service.ts
class Client {
	public request(): string {
		return "ok";
	}
}

export class Service {
	private readonly client = new Client();

	public report(): void {
		console.log(this.client.request());
	}
}
// File: cli.ts
import { Service } from "src/service";

(() => {
	const service = new Service();
	service.report();
})();
```


## Good

```ts
// File: src/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _status report output_. **/
	public report(): void {
		console.log(this.label("ready"));
		console.log(this.label_with_prefix("State", "ready"));
		console.log(this.uppercase_fallback());
		console.log(this.status_count());
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";

(function () {
	const owner = new StatusLabels(new Map([["ready", "Ready"]]), "Unknown");
	owner.report();
})();
```
