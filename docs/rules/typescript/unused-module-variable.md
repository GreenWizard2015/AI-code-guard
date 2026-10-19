# `unused-module-variable`

Description: Reports a module-level variable with no production symbol usage. Move owned state
behind an explicit owner or remove the unused variable.

## Bad

```ts
// File: source.ts
let request_count = 0; // <- error
```


## Good

```ts
// File: cli.ts
#!/usr/bin/env node
(function () {
	const request_count = 0;
	console.log(request_count);
})();
```

