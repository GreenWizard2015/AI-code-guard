# `method-handle-name`

Description: Review public commands beginning with `handle*`. `handleRequest()` or
`handleEvent()` says only “do something with X”. Prefer the real action, such
as `respond()`, `retry()`, `reject()`, `publish()`, or `store()`. Framework
callback boundaries may legitimately retain `handle`.

## Bad

```ts
// File: src/request_handler.ts
export class RequestHandler {
	private readonly request: string;
	public constructor(request: string) { this.request = request; }
	public handle_request(): string { return `Response: ${this.request.trim()}`; } // <- error
	public report(): void {
		const response = this.handle_request();
		console.log(response);
	}
}
// File: cli.ts
import { RequestHandler } from "src/request_handler";
(function () {
	const handler = new RequestHandler("account refresh");
	handler.report();
})();
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _status label mapping_. **/
export class PriceLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const price_labels = new PriceLabels(labels, "Unknown");
	price_labels.report();
})();
```
