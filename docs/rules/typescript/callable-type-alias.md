# `callable-type-alias`

Description: Put every TypeScript function type in a named type alias whose name starts with
`Callable`. Reuse that alias in fields and parameters.

## Bad

```ts
// File: src/handler_reporter.ts
export class HandlerReporter {
	private readonly handler: (value: string) => string; // <- error
	public constructor(handler: (value: string) => string) { // <- error
		this.handler = handler;
	}
	public normalized_value(): string {
		return this.handler(" ready ").trim().toLowerCase();
	}
	public formatted_output(): string {
		return `Result: ${this.normalized_value()}`;
	}
	public report(): void {
		console.log(this.formatted_output());
	}
}
// File: src/cli.ts
import { HandlerReporter } from "src/handler_reporter";
(function () {
	const reporter = new HandlerReporter((value) => value);
	reporter.report();
})();
```

## Good

```ts
// File: src/types.ts
export type CallableHandler = (value: string) => string;
// File: src/handler_reporter.ts
import type { CallableHandler } from "src/types";
export class HandlerReporter {
	private readonly _handler: CallableHandler;
	private readonly _initial_value: string;
	public constructor(handler: CallableHandler, initial_value: string) {
		this._handler = handler;
		this._initial_value = initial_value;
	}
	public normalized_value(): string {
		const transformed_value = this._handler(this._initial_value);
		const trimmed_value = transformed_value.trim();
		return trimmed_value.toLowerCase();
	}
	public formatted_output(): string {
		const normalized = this.normalized_value();
		const label = "Result";
		return `${label}: ${normalized}`;
	}
	public character_count(): number {
		const output = this.formatted_output();
		const characters = Array.from(output);
		return characters.length;
	}
	public report(): void {
		const output = this.formatted_output();
		const count = this.character_count();
		console.log(`${output} (${count} characters)`);
	}
}
// File: src/cli.ts
import { HandlerReporter } from "src/handler_reporter";
(function () {
	const reporter = new HandlerReporter((value) => value, " ready ");
	reporter.report();
})();
```
