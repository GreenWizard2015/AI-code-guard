# `object-prototype-string`

Description: Prototype inspection is a weak type contract.

```ts
Object.prototype.toString.call(value)
```


Fix: Use a named type guard or an explicit value check.

## Bad

```ts
// File: cli.ts
(function () {
	const label = Object.prototype.toString.call("value");
	console.log(label);
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const is_text = typeof "value" === "string";
	console.log(is_text);
})();
```
