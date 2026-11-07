# `proxy-callable`

Description: A function that only forwards its arguments, forwards a zero-argument call, or exposes one property, adds no behavior.

```ts
function update(id: string, title: string) { return flow.update(id, title); }

class Contact {
  private readonly required_reason_value: string;

  public constructor(required_reason: string) {
    this.required_reason_value = required_reason;
  }

  public close_contact_reason() {
    return this.required_reason_value;
  }
}
```

## Bad

```ts
// File: src/flow.ts
export class Flow {
	public update(identifier: string, title: string): string {
		return `${identifier}: ${title}`;
	}
}
// File: src/proxy.ts
import { Flow } from "src/flow";
const flow = new Flow();
export function update(identifier: string, title: string): string {
	return flow.update(identifier, title);
}
// File: src/output.ts
export class OutputReporter {
	public write(message: string): void {
		console.log(message);
}
}
// File: cli.ts
import { OutputReporter } from "src/output";
import { update } from "src/proxy";
(function () {
	const message = update("u-1", "Ready");
	const reporter = new OutputReporter();
	reporter.write(message);
})();
```


**Fix:** Call `flow.update()` at the caller or move real behavior to the owning class.


## Good

```ts
// File: src/domain/status.ts
export class Status {
	private readonly _value: string;
	private readonly _normalized_values: Map<string, string>;
	public constructor(value: string) {
		this._value = value;
		this._normalized_values = new Map();
	}
	public normalized(): string {
		const cached_value = this._normalized_values.get(this._value);
		if (cached_value !== undefined) {
			return cached_value;
		}
		const normalized_value = this._value.trim().toLowerCase();
		this._normalized_values.set(this._value, normalized_value);
		return normalized_value;
	}
	public ready(): boolean {
		const normalized_value = this.normalized();
		const expected_value = 'ready';
		return normalized_value === expected_value;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const status_value = this.normalized();
		return `${clean_prefix}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return status_value.includes(normalized_fragment);
	}
	public report(): void {
		const output = [
			this.normalized(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(output.join(" | "));
	}
}
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```

