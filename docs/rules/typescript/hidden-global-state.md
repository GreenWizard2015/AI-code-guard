# `hidden-global-state`

Description: Avoid independently mutating shared module-level collections from multiple
production callables. Give mutable state one explicit owner and lifecycle; local
state and a single owner with named transitions are allowed.

## Bad

```ts
// File: src/request_state.ts
const pending = new Map<string, string>();

export function enqueue_request(request_id: string): void {
	pending.set(request_id, "queued");
}

export function cancel_request(request_id: string): void {
	pending.delete(request_id);
}
```


## Good

```ts
// File: cli.ts
(function () {
	const pending = new Map<string, string>();
	const request_id = "request-1";
	const status = "queued";
	pending.set(request_id, status);
	console.log(pending.get(request_id));
})();
```

