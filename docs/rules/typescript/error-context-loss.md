# error-context-loss

Description: Reports only explicit exception-context suppression:

- TypeScript catches a named error and throws a new `*Error` without using the
  caught error, its message, or a `cause` property.
- Python uses `raise ... from None` inside an exception handler.

Rethrowing the original error, passing it to the new error, and ordinary
boundary translation remain allowed.

## Bad

```ts
try {
	return parse_document(text);
} catch (error) {
	throw new DocumentError("Invalid document");
}
```


## Good

```ts
// File: cli.ts
(function () {
	try {
		throw new Error("source failure");
	} catch (error) {
		throw new Error("Invalid document", { cause: error });
	}
})();
```

