# repeated-literal

Description: Production code should not repeat the same non-trivial string literal two or
more times.

Bad:

```ts
function report(): void {
  write("connection is unavailable");
  log("connection is unavailable");
  throw new Error("connection is unavailable");
}
```

Name the shared value or domain error once. If a matching project constant already
exists, every literal occurrence is reported as a use-the-constant violation,
even when it occurs only once. Otherwise, two or more production occurrences
are reported as a request to introduce a constant. The rule ignores strings
shorter than eight characters, standalone documentation strings, and test
files. Strings used as arguments or nested object, array, and collection values
are included at every depth.

## Bad

```ts
throw new Error("read failed");
log("read failed");
```


## Good

```ts
// File: src/constants.ts
export const ERROR_MESSAGE = "read failed";
// File: cli.ts
import { ERROR_MESSAGE } from "src/constants";
(function () { throw new Error(ERROR_MESSAGE); })();
```

