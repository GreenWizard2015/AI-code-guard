# `in-operator`

Description: See the examples below for the rule behavior.

### Purpose

Do not use `if (key in value)` for ordinary object membership checks. The operator hides
whether the code is checking an own property, an inherited property, or a collection key.

### Preferred

```ts
if (options.has(name)) {
	return options.get(name);
}
```

The rule allows the right-hand side only when its annotation resolves to a built-in `Map`,
`Set`, `WeakMap`, or `WeakSet` (including read-only variants). A local type with one of
those names is not a collection. Use the collection's named API for membership.

## Bad

```ts

type Map = Record<string, string>;
const options: Map = { name: "Ada" };

if ("name" in options) { // <- error
	console.log(options.name);
}
```

## Good

```ts
(function () {
	const options: Map<string, string> = new Map();
	const name = "Ada";

	if (options.has(name)) {
		console.log(options.get(name));
	}
})();
```
