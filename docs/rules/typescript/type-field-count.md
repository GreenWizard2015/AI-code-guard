# `type-field-count`

Description: Keep named data contracts focused. A type contract may declare at most 10 fields.

## Bad

```ts
// File: src/types.ts
export type RequestContract = { request_id: string; method: string;
	path: string;
	query: string; headers: string;
	body: string;
	started_at: number;
	timeout_ms: number;
	retry_count: number;
	priority: number;
	trace_id: string; // <- error
};
```


## Good

```ts
// File: src/types.ts
export type RequestContract = {
	request_id: string;
	method: string;
	path: string;
	query: string;
	headers: string;
	body: string;
	started_at: number;
	timeout_ms: number;
	retry_count: number;
};
// File: src/cli.ts
import { RequestContract } from "src/types";
(function () { const request: RequestContract = { request_id: "r-1", method: "GET", path: "/", query: "", headers: "", body: "", started_at: 0, timeout_ms: 1000, retry_count: 0 }; console.log(request.request_id); })();
```

