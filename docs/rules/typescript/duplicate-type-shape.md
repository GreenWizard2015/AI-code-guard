# `duplicate-type-shape`

Description: Reports distinct named object types or Python classes with identical sorted
field/type and base-type signatures. Field order does not affect the shape.
Python classes with different native bases remain distinct.

## Bad

```ts
// File: src/response_types.ts
export type JsonResponse = { status: number; payload: string };
export type TextResponse = { status: number; payload: string };
// File: src/response_reporter.ts
import type { JsonResponse, TextResponse } from "src/response_types";

/** Responsibilities: _response reporting_. **/
export class ResponseReporter {
	private readonly responses: ReadonlyArray<JsonResponse | TextResponse>;

	/** Responsibilities: _response collection initialization_. **/
	public constructor(json_response: JsonResponse, text_response: TextResponse) {
		this.responses = [json_response, text_response];
	}

	/** Responsibilities: _response summaries_. **/
	public summaries(): string[] {
		return this.responses.map((response) => {
			const payload = response.payload.trim();
			let classification = "accepted";
			if (response.status >= 400) {
				classification = "rejected";
			}
			if (payload.length === 0) {
				return `${classification}: empty response`;
			}
			return `${classification}: ${response.status} ${payload}`;
		});
	}

	/** Responsibilities: _response output_. **/
	public report(): void {
		const output = this.summaries().join(" | ");
		console.log(output);
	}
}
// File: cli.ts
import { ResponseReporter } from "src/response_reporter";

(() => {
	const reporter = new ResponseReporter(
		{ status: 200, payload: "ready" },
		{ status: 200, payload: "ready" },
	);
	reporter.report();
})();
```


## Good

```ts
// File: src/response_types.ts
export type Response = { status: number; payload: string };
// File: src/response_reporter.ts
import type { Response } from "src/response_types";

/** Responsibilities: _response reporting_. **/
export class ResponseReporter {
	private readonly _responses: ReadonlyArray<Response>;

	/** Responsibilities: _response collection initialization_. **/
	public constructor(responses: ReadonlyArray<Response>) {
		this._responses = responses;
	}

	/** Responsibilities: _response summaries_. **/
	public summaries(): string[] {
		return this._responses.map((response) => {
			const payload = response.payload.trim();
			let classification = "accepted";
			if (response.status >= 400) {
				classification = "rejected";
			}
			if (payload.length === 0) {
				return `${classification}: empty response`;
			}
			return `${classification}: ${response.status} ${payload}`;
		});
	}

	/** Responsibilities: _response output_. **/
	public report(): void {
		const output = this.summaries().join(" | ");
		console.log(output);
	}
}
// File: cli.ts
import { ResponseReporter } from "src/response_reporter";

(() => {
	const reporter = new ResponseReporter([
		{ status: 200, payload: "ready" },
		{ status: 200, payload: "ready" },
	]);
	reporter.report();
})();
```

