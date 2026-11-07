# `type-field-count`

Description: Keep named data contracts focused. A type contract may declare at most 10 fields.

## Bad

```ts
// File: src/request_reporter.ts
export class RequestReporter {
	private readonly request_id: string;

	public constructor(request_id: string) {
		this.request_id = request_id;
	}

	public format_identifier(): string {
		return this.request_id.trim().toLowerCase();
	}

	public format_summary(): string {
		const identifier = this.format_identifier();
		return `Request ${identifier}`;
	}

	public identifier_length(): number {
		return this.format_identifier().length;
	}

	public report(): void {
		const summary = this.format_summary();
		const length = this.identifier_length();
		console.log(`${summary} (${length} characters)`);
	}
}
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
// File: cli.ts
import { RequestReporter } from "src/request_reporter";
import type { RequestContract } from "src/types";

(function run(): void {
	const request: RequestContract = {
		request_id: "r-1", method: "GET", path: "/", query: "", headers: "",
		body: "", started_at: 0, timeout_ms: 1000, retry_count: 0,
		priority: 1, trace_id: "trace-1",
	};
	const reporter = new RequestReporter(request.request_id);
	reporter.report();
})();
```


## Good

```ts
// File: src/request_reporter.ts
export class RequestReporter {
	private readonly _identifier_cache: Map<string, string>;
	private readonly _request_id: string;

	public constructor(request_id: string) {
		this._request_id = request_id;

		this._identifier_cache = new Map();}

	public format_identifier(): string {
		const cached = this._identifier_cache.get(this._request_id);
		if (cached !== undefined) { return cached; }
		const identifier = this._request_id.trim().toLowerCase();
		this._identifier_cache.set(this._request_id, identifier);
		return identifier;
	}

	public format_summary(): string {
		const identifier = this.format_identifier();
		return `Request ${identifier}`;
	}

	public identifier_length(): number {
		return this.format_identifier().length;
	}

	public report(): void {
		const summary = this.format_summary();
		const length = this.identifier_length();
		console.log(`${summary} (${length} characters)`);
	}
}
// File: src/types.ts
export type RequestData = {
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
// File: cli.ts
import { RequestReporter } from "src/request_reporter";
import type { RequestData } from "src/types";

(function run(): void {
	const request: RequestData = {
		request_id: "r-1", method: "GET", path: "/", query: "", headers: "",
		body: "", started_at: 0, timeout_ms: 1000, retry_count: 0,
	};
	const reporter = new RequestReporter(request.request_id);
	reporter.report();
})();
```

