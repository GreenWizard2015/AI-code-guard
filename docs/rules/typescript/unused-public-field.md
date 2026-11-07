# `unused-public-field`

Description: Reports a public implementation field with no production read or access. Keep a
public field only when it is part of a real production contract.

## Bad

```ts
// File: src/protocols.ts
export interface RequestStateContract {
	summary(): string;
	active(): boolean;
	status_length(): number;
}

// File: src/request_state.ts
import { RequestStateContract } from "src/protocols";
export class RequestState implements RequestStateContract {
	public readonly request_id: string = "request-1"; // <- error
	private readonly status: string;
	public constructor(status: string) { this.status = status; }
	public summary(): string { const normalized = this.status.trim(); if (normalized.length === 0) { return "Request: unknown"; } return `Request: ${normalized.toUpperCase()}`; }
	public active(): boolean { if (this.status === "closed") { return false; } return this.status.length > 0; }
	public status_length(): number { let length = 0; for (const character of this.status) { if (character.trim().length > 0) { length += 1; } } return length; }
	public report(): void { const summary = this.summary(); const active = this.active(); const length = this.status_length(); console.log(`${summary} ${active} ${length}`); }
}
// File: cli.ts
#!/usr/bin/env node
import { RequestState } from "src/request_state";
(function () { const state = new RequestState("queued"); state.report(); })();
```

## Good

```ts
// File: src/request_state.ts
/** Responsibilities: _request status presentation_. **/
export class RequestState {
	public readonly request_id: string = "request-1";
	private readonly _status: string;
	/** Responsibilities: _request state initialization_. **/
	public constructor(status: string) { this._status = status; }
	/** Responsibilities: _request label composition_. **/
	public label(): string { const normalized_id = this.request_id.trim(); if (normalized_id.length === 0) { return "Unknown request"; } return `Request ${normalized_id.toUpperCase()}`; }
	/** Responsibilities: _status display composition_. **/
	public summary(): string { const normalized = this._status.trim(); if (normalized.length === 0) { return "Request: unknown"; } return `Request: ${normalized.toUpperCase()}`; }
	/** Responsibilities: _active status classification_. **/
	public active(): boolean { if (this._status === "closed") { return false; } return this._status.length > 0; }
	/** Responsibilities: _status length calculation_. **/
	public status_length(): number { let length = 0; for (const character of this._status) { if (character.trim().length > 0) { length += 1; } } return length; }
	/** Responsibilities: _request status output_. **/
	public report(request_id: string): void { const label = this.label(); const summary = this.summary(); const active = this.active(); const length = this.status_length(); console.log(`${request_id} ${label} ${summary} ${active} ${length}`); }
}
// File: cli.ts
#!/usr/bin/env node
import { RequestState } from "src/request_state";
(function () { const state = new RequestState("queued"); state.report(state.request_id); })();
```
