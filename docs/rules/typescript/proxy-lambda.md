# `proxy-lambda`

Description: Reject a lambda that only forwards its parameters, in any order, to a method of the current project-owned object.


```ts
(expression, owner) => this.resolve_owner(expression, owner)
```


Fix: Call the owning method directly or pass the owning object through the interface. The rule compares parameter references with forwarded argument references without requiring positional order or a special method name. Callbacks passed directly to external APIs, such as `HTMLElement.addEventListener`, are outside this rule because they are call arguments rather than object-property implementations.

## Bad

```ts
interface OwnerResolverContract { dispatch(expression: string, owner: string): string; }
class Context implements OwnerResolverContract {
	public dispatch(expression: string, owner: string): string { return owner + expression; }
	public bad(): OwnerResolverContract {
		const dispatch = this.dispatch;
		return { dispatch: (expression, owner) => dispatch(owner, expression) }; // <- error
	}
}
```


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

