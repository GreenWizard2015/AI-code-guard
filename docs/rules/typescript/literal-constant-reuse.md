# literal-constant-reuse

Description: Use an existing named constant when production code repeats its non-trivial
string value. The diagnostic is reported at each literal occurrence, including
when the value is used only once in the consuming callable.

Bad:

```ts
const CONNECTION_MESSAGE = "connection is unavailable";

function report(): void {
  write("connection is unavailable");
}
```

Good:

```ts
const CONNECTION_MESSAGE = "connection is unavailable";

function report(): void {
  write(CONNECTION_MESSAGE);
}
```

The rule applies to TypeScript and Python production code and ignores test
files and short strings.

## Bad

```ts
const CONNECTION_MESSAGE = "connection is unavailable";

function report_connection_state(): void {
	console.log("connection is unavailable");
}
```


## Good

```ts
// File: src/constants.ts
export const ERROR_MESSAGE = "read failed";
// File: cli.ts
import { ERROR_MESSAGE } from "src/constants";
(function () { throw new Error(ERROR_MESSAGE); })();
```

