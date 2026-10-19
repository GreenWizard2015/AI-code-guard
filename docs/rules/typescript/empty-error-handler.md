# empty-error-handler

Description: Reports an empty TypeScript `catch` block or a Python `except` block containing
only `pass` or a standalone string. Handle, rethrow, or explicitly transform
the error instead. A handler with real recovery or reporting code is not
reported.

## Bad

```ts
try {
	load_config();
} catch {
}
```


## Good

```ts
(() => {
	try {
		load_config();
	} catch (error) {
		throw new ConfigError("Configuration cannot be loaded", { cause: error });
	}
})();
```

