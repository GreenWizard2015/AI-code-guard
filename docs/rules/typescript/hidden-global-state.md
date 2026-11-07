# `hidden-global-state`

Description: Avoid independently mutating shared module-level collections from multiple
production callables. Give mutable state one explicit owner and lifecycle; local
state and a single owner with named transitions are allowed.

## Bad

```ts
// File: src/request_state.ts
const pending = new Map<string, string>();

export function enqueue_request(request_id: string): void {
	pending.set(request_id, "queued");
}

export function cancel_request(request_id: string): void {
	pending.delete(request_id);
}
export function report_requests(): void {
	const statuses = Array.from(pending.values()).join(", ");
	console.log(`Pending requests: ${statuses}`);
}
// File: cli.ts
import { enqueue_request, report_requests } from "src/request_state";
(function () {
	enqueue_request("request-1");
	report_requests();
})();
```


## Good

```ts
// File: src/request_queue.ts
export class RequestQueue {
	private readonly _queued_status: string;
	private readonly _missing_status: string;
	private readonly _summary_prefix: string;
	private readonly _pending: Map<string, string>;
	public constructor() {
		this._queued_status = "queued";
		this._missing_status = "missing";
		this._summary_prefix = "Pending requests: ";
		this._pending = new Map<string, string>();
	}
	public enqueue(new_request_id: string): void {
		this._pending.set(new_request_id, this._queued_status);
	}
	public cancel(cancelled_request_id: string): void {
		this._pending.delete(cancelled_request_id);
	}
	public status(lookup_request_id: string): string {
		const current_status = this._pending.get(lookup_request_id);
		if (current_status === undefined) {
			return this._missing_status;
		}
		return current_status;
	}
	public summary(): string {
		const request_ids = Array.from(this._pending.keys());
		const statuses: string[] = [];
		for (const request_id of request_ids) {
			statuses.push(this.status(request_id));
		}
		return `${this._summary_prefix}${statuses.join(", ")}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { RequestQueue } from "src/request_queue";
(function () {
	const requests = new RequestQueue();
	const first_request_id = "request-1";
	const second_request_id = "request-2";
	requests.enqueue(first_request_id);
	requests.enqueue(second_request_id);
	requests.cancel(second_request_id);
	requests.report();
})();
```

