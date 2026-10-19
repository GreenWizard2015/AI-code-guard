# `object-assign`

Description: Bulk mutation hides which owned fields change.

```ts
Object.assign(this.state, update);
```


Fix: Assign owned fields explicitly or return a new state value.

## Bad

```ts
// File: cli.ts
(function () {
	const state = { value: "old" };
	Object.assign(state, { value: "new" });
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const state = { value: "old" };
	state.value = "new";
	console.log(state.value);
})();
```
