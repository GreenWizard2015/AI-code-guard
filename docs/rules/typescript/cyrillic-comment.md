# `cyrillic-comment`

Description: Comments and supported text files must use English. Cyrillic remains allowed
inside a source string assigned to a value or returned from a callable.

## Bad

```ts
// File: cli.ts
(function () {
	// Состояние приложения готово.
	const message = "Ready";
	console.log(message);
})();
```


## Good

```ts
// File: cli.ts
(function () {
	// User-facing localized text stays in data.
	const message = "Готово";
	console.log(message);
})();
```

