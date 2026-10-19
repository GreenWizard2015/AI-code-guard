# `duplicate-error-translation`

Description: Reports a production `catch` or `except` handler that constructs the identical
error translation more than once. Preserve meaningful differences in error
category or context; merge paths that produce the same result.

## Bad

```ts
// File: cli.ts
(function () {
	try {
		throw new Error("source failure");
	} catch (error) {
		if (error instanceof Error) {
			throw new RuntimeError("document parsing failed");
		}
		throw new RuntimeError("document parsing failed");
	}
})();
```


## Good

```ts
// File: cli.ts
(function () {
	try {
		throw new Error("source failure");
	} catch (error) {
		throw new Error("document parsing failed", { cause: error });
	}
})();
```

