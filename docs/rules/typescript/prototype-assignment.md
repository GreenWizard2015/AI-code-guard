# `prototype-assignment`

Description: Prototype mutation obscures class ownership and invariants.

```ts
User.prototype.load = function () { /* ... */ };
```


Fix: Declare `class User` and place `load()` in its body.

## Bad

```ts
class User {}
User.prototype.load = function (): string { return "ready"; };
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
