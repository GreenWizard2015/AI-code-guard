# `typescript-in-operator`

## Purpose

Do not use `if (key in value)` for ordinary object membership checks. The operator hides
whether the code is checking an own property, an inherited property, or a collection key.

## Bad

```ts
if (name in options) {
	return options[name];
}
```

## Preferred

```ts
if (options.has(name)) {
	return options.get(name);
}
```

The rule allows the right-hand side when it is explicitly typed as `Map`, `Set`, `WeakMap`,
or `WeakSet` (including read-only variants). Use the collection's named API for membership.
