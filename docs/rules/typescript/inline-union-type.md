# `inline-union-type`

Description: Anonymous literal unions hide finite value contracts in signatures and fields.

```ts
type AstCallableReference = { kind: 'function' | 'method'; };
```


Fix: Declare `type CallableKind = 'function' | 'method'` and use `CallableKind`.

## Bad

```ts
// File: src/protocols.ts
export interface CallableContract {
	invoke(kind: "function" | "method"): string;
}
// File: src/callable_router.ts
import type { CallableContract } from "src/protocols";

export class CallableRouter implements CallableContract {
	private readonly owner: string;
	public constructor(owner: string) {
		this.owner = owner;
	}
	public invoke(kind: "function" | "method"): string {
		if (kind === "function") {
			return `${this.owner} function`;
		}
		return `${this.owner} method`;
	}
	public report(): void {
		const function_result = this.invoke("function");
		const method_result = this.invoke("method");
		console.log(`${function_result} | ${method_result}`);
	}
}
// File: cli.ts
import { CallableRouter } from "src/callable_router";
(function () {
	const router = new CallableRouter("handler");
	router.report();
})();
```

## Good

```ts
// File: src/types.ts
export type CallableKind = "function" | "method";
// File: src/callable_catalog.ts
import type { CallableKind } from "src/types";

export class CallableCatalog {
	private readonly _owner: string;
	private readonly _described_kinds: Set<CallableKind>;
	public constructor(owner: string) {
		this._owner = owner;
		this._described_kinds = new Set<CallableKind>();
	}
	public describe(kind: CallableKind): string {
		this._described_kinds.add(kind);
		return `${this.owner_label()} ${kind.toUpperCase()}`;
	}
	public owner_label(): string {
		const words = this._owner.trim().split(/\s+/u);
		const formatted_words: string[] = [];
		for (const word of words) {
			const initial = word.slice(0, 1).toUpperCase();
			const remainder = word.slice(1).toLowerCase();
			formatted_words.push(`${initial}${remainder}`);
		}
		return formatted_words.join(" ");
	}
	public summary(): string {
		const function_description = this.describe("function");
		const method_description = this.describe("method");
		return `${function_description} | ${method_description}`;
	}
	public report(): void {
		const owner = this.owner_label();
		const description = this.summary();
		const report_line = `${owner}: ${description} (${this._described_kinds.size} kinds)`;
		console.log(report_line);
	}
}
// File: cli.ts
import { CallableCatalog } from "src/callable_catalog";
(function () {
	const catalog = new CallableCatalog("handler");
	catalog.report();
})();
```
