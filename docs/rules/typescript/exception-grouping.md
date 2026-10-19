# `exception-grouping`

Description: A one-use exception should stay close to the caller that handles it.


## Bad

```ts
export class NetworkError extends Error {}
```


**Fix:** Move the `Error` class into its caller module, or group related exceptions in one
focused module. Do not keep a one-use exception isolated in its own file.

```ts
export class NetworkError extends Error {}
```

## Good

```ts
// File: cli.ts
#!/usr/bin/env node
(function () { try { read(); } catch (error) { throw new Error("read failed", { cause: error }); } })();
```

