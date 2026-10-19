# `conditional-execution`

Description: Avoid hiding side effects inside `&&`, `||`, `??`, `and`, or `or`. Use an
explicit branch when a logical condition controls an operation. Pure boolean
expressions remain valid.

## Bad

```ts
// File: cli.ts
(function () {
	const is_ready = true;
	const did_send = is_ready && console.log("message sent");
	console.log(did_send);
})();
```


## Good

```ts
// File: cli.ts
(function () {
	const is_ready = true;
	const has_message = false;
	const is_deliverable = is_ready && has_message;
	console.log(is_deliverable);
})();
```

