# `mutable-field`

Description: Unnecessary TypeScript field mutation increases lifecycle coupling.

```ts
class Cache { public value: Result | null = null; }
```


Fix: Prefer `readonly` and return updated state; keep mutation only when it is intentional.

## Bad

```ts
class Cache {
	public value: number = 0;
}
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
