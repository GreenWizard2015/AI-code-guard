# `mutable-field-assignment`

Description: Mutation outside construction makes object state hard to reason about.

Keep state in a named state contract and class. Make a transition return a new
state instance instead of assigning to the existing instance's fields.

## Bad

```ts
// File: src/cache_state/cache_state.ts
export class CacheState {
	private value: string;
	private revision: number;
	public constructor(value: string, revision: number) {
		this.value = value;
		this.revision = revision;
	}
	public with_value(value: string): void {
		this.value = value.trim();
		this.revision += 1;
	}
	public summary(): string {
		return `${this.value}:${this.revision}`;
	}
}
// File: src/cache_state/cli.ts
import { CacheState } from "src/cache_state/cache_state";
(function () {
	const state = new CacheState("", 0);
	state.with_value("ready");
	console.log(state.summary());
})();
```


## Good

```ts
// File: src/cache_state/protocols.ts
export interface CacheStateContract {
	with_value(value: string): CacheStateContract;
	summary(): string;
}
// File: src/cache_state/cache_state.ts
import type { CacheStateContract } from "src/cache_state/protocols";
export class CacheState implements CacheStateContract {
	private readonly value: string;
	private readonly revision: number;
	public constructor(value: string, revision: number) {
		this.value = value;
		this.revision = revision;
	}
	public with_value(value: string): CacheStateContract {
		const next_value = value.trim();
		const next_revision = this.revision + 1;
		return new CacheState(next_value, next_revision);
	}
	public summary(): string {
		return `${this.value}:${this.revision}`;
	}
}
// File: src/cache_state/cli.ts
import { CacheState } from "src/cache_state/cache_state";
import type { CacheStateContract } from "src/cache_state/protocols";
(function () {
	let state: CacheStateContract = new CacheState("", 0);
	state = state.with_value("ready");
	console.log(state.summary());
})();
```

