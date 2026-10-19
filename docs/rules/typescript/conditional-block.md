# `conditional-block`

Description: Unbraced branches are easy to extend incorrectly.

```ts
if (ready) send();
```


Fix: Always use braces: `if (ready) { send(); }`.

## Bad

```ts
if (ready) send();
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
