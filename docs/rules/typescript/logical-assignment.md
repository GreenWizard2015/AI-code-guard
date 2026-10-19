# `logical-assignment`

Description: Logical assignment hides a conditional state transition in TypeScript.

```ts
value ??= create_value();
cache ||= load_cache();
```


Fix: Use an explicit condition followed by an assignment. Keep the state transition visible.

## Bad

```ts
// File: cli.ts
(function () {
	let ready = false;
	ready ||= true;
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
