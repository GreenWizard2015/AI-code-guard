# incomplete-cache-key

Description: Reports a callable that reads from one cache receiver with `get(key)` and then
writes to the same receiver with `set(other_key, value)`. The rule intentionally
does not infer missing semantic inputs; it reports only a provable mismatch in
the lookup and write expressions.

TypeScript:

```ts
function load(file: string, text: string): Result {
  const cached = cache.get(file);
  cache.set(file + text, create_result());
  return cached;
}
```

Python:


Use one named key expression or key-building operation for both operations.

## Bad

```ts
function load(cache: Map<string, string>, key: string): string {
	const cached = cache.get(key) ?? "";
	cache.set(`${key}:refresh`, cached);
	return cached;
}
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
