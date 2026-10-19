# `broad-except`

Description: Broad catches hide unrelated programming failures.


TypeScript catches without a specific error boundary are also reported:

```ts
try {
	run();
} catch {
	recover();
}
```


Fix: Catch only the expected exception at the I/O, network, process, or JSON boundary.

## Bad

```ts
try { read(); } catch { }
```


## Good

```ts
// File: cli.ts
(function () {
	try {
		const url = new URL("https://example.test/resource");
		const hostname = url.hostname;
		console.log(hostname);
	} catch (error) {
		throw new Error("Invalid resource URL", { cause: error });
	}
})();
```

