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
function update(identifier: string, title: string): string {
	return flow.update(identifier, title);
}
```


**Fix:** Call `flow.update()` at the caller or move real behavior to the owning class.


## Good

```ts
// File: src/domain/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string {
		return this.value.trim().toLowerCase();
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
}
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	console.log(status.normalized(), status.ready(), status.label('State'), status.contains('ead'));
})();
```

