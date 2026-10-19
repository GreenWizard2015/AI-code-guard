# retry-without-ownership

Description: Reports a production `while (true)` loop that calls an operation inside a
`try` block and continues from its error handler without an attempt limit. The
rule is deliberately narrower than a general retry scan: bounded loops, test
files, and loops without an operation are allowed. A deliberate worker loop
with this exact retry shape must still expose its retry ownership explicitly.

TypeScript:

```ts
while (true) {
  try {
    request();
  } catch (error) {
    continue;
  }
}
```

Python:


Add an attempt owner with a limit, backoff, or explicit recovery state.

## Bad

```ts
while (true) {
	try {
		request();
	} catch (error) {
		continue;
	}
}
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
