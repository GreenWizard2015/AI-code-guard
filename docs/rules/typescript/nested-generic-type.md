# `nested-generic-type`

Description: Name nested generic applications at a contract boundary. For example, prefer
`Promise<Result>` or `list[Result]` to nested generic types that conceal several
representations in one signature.

## Bad

```ts
// File: src/lookup.ts
type Result = { value: string };

export class Lookup {
	emit(value: Promise<Array<Result>>): void {
		console.log("ready");
	}
}
// File: cli.ts
import { Lookup } from "src/lookup";

(() => {
	new Lookup().emit(Promise.resolve([]));
})();
```


## Good

```ts
// File: src/types.ts
export type LookupRecord = { value: string };
export type LookupResults = LookupRecord[];
// File: src/lookup_results_reporter.ts
import type { LookupRecord, LookupResults } from "src/types";

export class LookupResultsReporter {
	private readonly _results_by_key: Map<string, LookupRecord>;

	public constructor() {
		this._results_by_key = new Map<string, LookupRecord>();
	}

	public add(results: LookupResults): void {
		for (const record of results) {
			this._results_by_key.set(record.value, record);
		}
	}

	public result_count(): number {
		return this._results_by_key.size;
	}

	public report(): void {
		console.log(
			Array.from(this._results_by_key.values())
				.map((record) => record.value)
				.join(","),
		);
	}

	public clear(): void {
		this._results_by_key.clear();
	}
}
// File: cli.ts
import { LookupResultsReporter } from "src/lookup_results_reporter";

(() => {
	const reporter = new LookupResultsReporter();
	reporter.add([{ value: "ready" }]);
	if (reporter.result_count() > 0) {
		reporter.report();
	}
	reporter.clear();
})();
```

