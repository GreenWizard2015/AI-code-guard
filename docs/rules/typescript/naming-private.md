# `naming-private`

Description: Names must not begin with `_`.

Allowed exceptions:

- fields;
- private methods;
- names made only of underscores, such as `_` or `__`.

This applies to module-level symbols, parameters, types, classes, public and protected methods, and local variables. Do not hide a leading underscore behind an alias.

## Bad

```ts
// File: cli.ts
(function () {
	const _item_count = 1;
	console.log(_item_count);
})();
```


## Good

```ts
// File: cli.ts
(function () {
	const item_count = 1;
	console.log(item_count);
})();
```

