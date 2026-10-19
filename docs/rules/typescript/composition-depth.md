# `composition-depth`

Description: Deep wrapper chains couple behavior to too many ownership layers.

```text
A -> B -> C -> D
```


Fix: Remove pass-through layers and keep only classes with their own state or lifecycle.

## Bad

```ts
{% const layers = [{"name":"RequestCoordinator","next":"PolicyService","path":"request_coordinator","dependency_path":"policy_service","role":"request coordinator"},{"name":"PolicyService","next":"RecordStore","path":"policy_service","dependency_path":"record_store","role":"policy service"},{"name":"RecordStore","next":"RecordParser","path":"record_store","dependency_path":"record_parser","role":"record store"}] %}
{%for layer in layers %}
// File: src/{{layer.path}}.ts
import { {{layer.next}} } from "src/{{layer.dependency_path}}";
export class {{layer.name}} {
	private readonly dependency = new {{layer.next}}();
	public constructor() {}
	public run(): string { return this.dependency.run(); } // <- error
}
{% endfor %}
// File: src/record_parser.ts
export class RecordParser {
	private readonly state: string = "ready";

	public constructor() {}

	public run(): string { return this.state; }
}
```

## Good

```ts
// File: src/request.ts
/** Responsibilities: _request state_. **/
export class Request {
	private readonly state: string;

	/** Responsibilities: _request initialization_. **/
	public constructor() {
		this.state = "ready";
	}

	/** Responsibilities: _request state access_. **/
	public run(): string {
		const state = this.state.trim();
		if (state.length === 0) { return "Pending"; }
		return state;
	}

	/** Responsibilities: _request readiness classification_. **/
	public ready(): boolean { return this.state.trim() === "ready"; }

	/** Responsibilities: _request status label_. **/
	public status_label(): string {
		if (this.ready()) { return "Ready"; }
		return "Pending";
	}

	/** Responsibilities: _request state length_. **/
	public state_length(): number { return this.state.trim().length; }

	/** Responsibilities: _request summary_. **/
	public summary(): string {
		const label = this.status_label();
		const length = this.state_length();
		return `${label} (${length} characters)`;
	}
}
// File: cli.ts
import { Request } from "src/request";

(function () {
	const request = new Request();
	console.log(request.run(), request.ready(), request.status_label(), request.state_length(), request.summary());
})();
```
