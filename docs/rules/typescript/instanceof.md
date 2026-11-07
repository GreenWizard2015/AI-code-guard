# `instanceof`

Description: Validate values at a boundary and avoid scattering repeated `instanceof` checks through business logic.

Use one `typeof` check at the external input boundary instead. Return the explicit
domain type from that boundary and do not repeat runtime checks in business logic.

## Bad

```ts
// File: src/failure_reporter.ts
/** Responsibilities: _failure message reporting_. **/
export class FailureReporter {
	private readonly failure: unknown;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(failure: unknown) {
		this.failure = failure;
	}
	/** Responsibilities: _failure boundary description_. **/
	public boundary_message(): string {
		if (this.failure instanceof Error) { return this.failure.message; }
		return "Unknown failure";
	}
	/** Responsibilities: _failure business description_. **/
	public business_message(): string {
		if (this.failure instanceof Error) { return `Request failed: ${this.failure.message}`; } // <- error
		return "Request failed";
	}
	/** Responsibilities: _failure report output_. **/
	public report(): void {
		console.log(`${this.boundary_message()} | ${this.business_message()}`);
	}
}
// File: cli.ts
import { FailureReporter } from "src/failure_reporter";

(() => {
	const reporter = new FailureReporter(new Error("Service unavailable"));
	reporter.report();
})();
```

## Good

```ts
// File: src/failure_reporter.ts
/** Responsibilities: _failure message reporting_. **/
export class FailureReporter {
	private readonly _failure_message: string;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(failure_message: string) {
		this._failure_message = failure_message.trim();
	}
	/** Responsibilities: _failure boundary description_. **/
	public boundary_message(): string {
		if (this._failure_message.length === 0) {
			return "Unknown failure";
		}
		return this._failure_message;
	}
	/** Responsibilities: _failure message formatting_. **/
	public business_message(): string {
		return `Request failed: ${this.boundary_message()}`;
	}
	/** Responsibilities: _failure category selection_. **/
	public category_label(): string {
		const message_length = this._failure_message.length;
		if (message_length > 20) {
			return "extended failure";
		}
		return "standard failure";
	}
	/** Responsibilities: _failure report composition_. **/
	public summary(): string {
		return `${this.category_label()} (${this._failure_message.length} characters): ${this.business_message()}`;
	}
	/** Responsibilities: _failure report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { FailureReporter } from "src/failure_reporter";

(() => {
	const reporter = new FailureReporter("Service unavailable");
	reporter.report();
})();
```
