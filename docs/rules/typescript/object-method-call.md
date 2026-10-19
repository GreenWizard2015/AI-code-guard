# `object-method-call`

Description: Indirect `.call` invocation obscures the receiver and contract.

```ts
Object.prototype.hasOwnProperty.call(value, key)
```


Fix: Use a typed helper or a direct, contract-specific operation.

## Bad

```ts
// File: cli.ts
(function () {
	const owns_value = Object.prototype.hasOwnProperty.call({ value: "x" }, "value");
	console.log(owns_value);
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const values = new Map<string, string>();
	const has_value = values.has("key");
	console.log(has_value);
})();
```
