# `composition-depth`

Description: Deep wrapper chains couple behavior to too many ownership layers.

```text
A -> B -> C -> D
```


Fix: Remove pass-through layers and keep only classes with their own state or lifecycle.

## Bad

```ts
{% const layers = [{"name":"RequestCoordinator","next":"PolicyService","path":"request_coordinator","dependency_path":"policy_service","role":"request coordinator"},{"name":"PolicyService","next":"RecordStore","path":"policy_service","dependency_path":"record_store","role":"policy service"},{"name":"RecordStore","next":"RecordParser","path":"record_store","dependency_path":"record_parser","role":"record store"},{"name":"RecordParser","next":"RecordValidator","path":"record_parser","dependency_path":"record_validator","role":"record parser"}] %}
// File: src/request_pipeline.ts
{%for layer in layers %}
export class {{layer.name}} {
	private readonly _dependency: {{layer.next}};
	public constructor() { this._dependency = new {{layer.next}}(); }
	public run(): string { return this._dependency.run(); } // <- error
	public report(): void { console.log(this.run()); }
}
{% endfor %}
export class RecordValidator {
	private readonly _state: string;
	public constructor() { this._state = "ready"; }
	public run(): string { return this._state; }
}
// File: cli.ts
import { RequestCoordinator } from "src/request_pipeline";
(function () { const coordinator = new RequestCoordinator(); coordinator.report(); })();
```

## Good

```ts
// File: src/request.ts
/** Responsibilities: _request state_. **/
export class Request {
	private readonly _state: string;

	/** Responsibilities: _request initialization_. **/
	public constructor(state: string) {
		this._state = state;
	}

	/** Responsibilities: _request readiness classification_. **/
	public ready(): boolean { return this._state.trim() === "ready"; }

	/** Responsibilities: _request status label_. **/
	public status_label(): string {
		if (this.ready()) { return "Ready"; }
		return "Pending";
	}

	/** Responsibilities: _request state length_. **/
	public state_length(): number { return this._state.trim().length; }

	/** Responsibilities: _request summary_. **/
	public summary(): string {
		const label = this.status_label();
		const length = this.state_length();
		return `${label} (${length} characters)`;
	}

	/** Responsibilities: _request report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { Request } from "src/request";

(function () {
	const request = new Request("ready");
	request.report();
})();
```
