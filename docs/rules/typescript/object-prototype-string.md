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
	const object_string = Object.prototype.toString;
	const values: object[] = ["value", 42];
	for (const value of values) {
		const tag = object_string.call(value); // <- error
		if (tag === "[object String]") {
			console.log("string value");
		} else {
			console.log("other value");
		}
	}
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
