# `test-exception-only`

Description: Tests must verify a result or observable behavior. A test that only checks
that an operation throws verifies an implementation detail instead of the behavior
visible to its caller.

Prefer asserting the observable result at the next public boundary. If a direct return
value does not exist, assert the state change, emitted event, or persisted record visible
to the caller.

## Bad

```ts
// File: src/request.ts
export class Request {
	private readonly responses: string[];

	public constructor() {
		this.responses = [];
	}

	public response_for(input: string): string {
		if (input.length === 0) {
			throw new Error("Invalid request");
		}
		const response = `200: ${input}`;
		this.responses.push(response);
		return response;
	}

	public response_count(): number {
		return this.responses.length;
	}

	public latest_response(): string {
		return this.responses.at(-1) ?? "No response";
	}

	public report(input: string): void {
		this.response_for(input);
		console.log(`${this.latest_response()} (${this.response_count()})`);
	}
}
// File: tests/request/request.test.ts
import { Request } from "src/request";

describe("Request", () => {
	test("rejects an empty request", () => {
		const request = new Request();
		expect(() => request.response_for("")).toThrow("Invalid request"); // <- error
	});
	test("returns a response for a valid request", () => {
		const request = new Request();
		expect(request.response_for("ready")).toBe("200: ready");
	});
});
// File: src/cli.ts
import { Request } from "src/request";

(() => {
	const request = new Request();
	request.report("ready");
})();
```

## Good

```ts
// File: src/request.ts
export class Request {
	private readonly _responses: string[];

	public constructor() {
		this._responses = [];
	}

	public response_for(input: string): string {
		const special_responses = new Map<string, string>([["", "400: Invalid request"]]);
		const mapped_response = special_responses.get(input);
		let response: string;
		if (mapped_response === undefined) {
			response = `200: ${input}`;
		} else {
			response = mapped_response;
		}
		this._responses.push(response);
		return response;
	}

	public response_count(): number {
		return this._responses.length;
	}

	public latest_response(): string {
		const response = this._responses.at(-1);
		if (response === undefined) {
			return "No response";
		}
		return response;
	}

	public report(input: string): void {
		this.response_for(input);
		console.log(`${this.latest_response()} (${this.response_count()})`);
	}
}
// File: tests/request/request.test.ts
import { Request } from "src/request";

describe("Request", () => {
	test("returns a bad-request response for empty input", () => {
		const request = new Request();
		const response = request.response_for("");
		expect(response).toBe("400: Invalid request");
		expect(request.response_count()).toBe(1);
	});
	test("returns a success response for nonempty input", () => {
		const request = new Request();
		expect(request.response_for("ready")).toBe("200: ready");
	});
});
// File: src/cli.ts
import { Request } from "src/request";

(() => {
	const request = new Request();
	request.report("ready");
})();
```
