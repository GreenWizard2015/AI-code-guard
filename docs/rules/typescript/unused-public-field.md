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
}
// File: cli.ts
#!/usr/bin/env node
import { RequestState } from "src/request_state";
(function () { const state = new RequestState("queued"); console.log(state.summary(), state.active(), state.status_length()); })();
```


## Good

```ts
// File: src/protocols.ts
export interface RequestStateContract {
	summary(): string;
	active(): boolean;
	status_length(): number;
}

// File: src/request_state.ts
import { RequestStateContract } from "src/protocols";
/** Responsibilities: _request state and status presentation_. **/
export class RequestState implements RequestStateContract {
	public readonly request_id: string = "request-1";
	private readonly status: string;
	/** Responsibilities: _request state initialization_. **/
	public constructor(status: string) { this.status = status; }
	/** Responsibilities: _request label composition_. **/
	public label(): string { const normalized_id = this.request_id.trim(); if (normalized_id.length === 0) { return "Unknown request"; } return `Request ${normalized_id.toUpperCase()}`; }
	/** Responsibilities: _status display composition_. **/
	public summary(): string { const normalized = this.status.trim(); if (normalized.length === 0) { return "Request: unknown"; } return `Request: ${normalized.toUpperCase()}`; }
	/** Responsibilities: _active status classification_. **/
	public active(): boolean { if (this.status === "closed") { return false; } return this.status.length > 0; }
	/** Responsibilities: _status length calculation_. **/
	public status_length(): number { let length = 0; for (const character of this.status) { if (character.trim().length > 0) { length += 1; } } return length; }
}
// File: cli.ts
#!/usr/bin/env node
import { RequestState } from "src/request_state";
(function () { const state = new RequestState("queued"); console.log(state.label(), state.summary(), state.active(), state.status_length()); })();
```

