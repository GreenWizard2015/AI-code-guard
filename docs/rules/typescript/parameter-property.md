# Explicit Constructor Fields

Description: TypeScript constructor parameter properties combine a parameter and a class field in one
declaration. Keep the field declaration and constructor assignment explicit so ownership and
initialization remain visible.

### Replacement

```ts
class Client {
  constructor(private readonly transport: Transport) {}
}
```

### Replacement

```ts
class Client {
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }
}
```

## Bad

```ts
// File: src/status_client.ts
/** Responsibilities: _status request reporting_. **/
export class StatusClient {
	public constructor(private readonly endpoint: string) { // <- error
	}
	/** Responsibilities: _endpoint normalization_. **/
	public normalized_endpoint(): string {
		return this.endpoint.trim().toLowerCase();
	}
	/** Responsibilities: _status response formatting_. **/
	public response_text(): string {
		return `Ready at ${this.normalized_endpoint()}`;
	}
	/** Responsibilities: _status response output_. **/
	public report(): void {
		console.log(this.response_text());
	}
}
// File: cli.ts
import { StatusClient } from "src/status_client";

(() => {
	const client = new StatusClient("/status");
	client.report();
})();
```

## Good

```ts
// File: src/service_endpoint.ts
/** Responsibilities: _service endpoint identity_. **/
export class ServiceEndpoint {
	private readonly _address: string;
	/** Responsibilities: _service endpoint initialization_. **/
	public constructor(address: string) {
		this._address = address;
	}
	/** Responsibilities: _endpoint normalization_. **/
	public normalized_address(): string {
		if (this._address.trim().length === 0) {
			return "";
		}
		return this._address.trim().toLowerCase().replace(/\/+$/u, "");
	}
	/** Responsibilities: _endpoint route extraction_. **/
	public route_name(): string {
		const normalized_address = this.normalized_address();
		const separator_index = normalized_address.lastIndexOf("/");
		const route_start = separator_index + 1;
		const route = normalized_address.slice(route_start);
		return route.toUpperCase();
	}
	/** Responsibilities: _endpoint summary formatting_. **/
	public summary(): string {
		return `${this.route_name()} (${this.normalized_address().length} characters)`;
	}
	/** Responsibilities: _endpoint report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ServiceEndpoint } from "src/service_endpoint";

(() => {
	const endpoint = new ServiceEndpoint("https://service.test/status");
	endpoint.report();
})();
```
