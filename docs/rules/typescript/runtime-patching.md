# `runtime-patching`

Description: Do not replace existing behavior or data. Inject a dependency implementation through its contract.

## Bad

```ts
// File: src/gateway.ts
export class Gateway {
	public send(): string {
		return "ready";
	}
	public replace_behavior(): void {
		this.send = () => "fake"; // <- error
		console.log(this.send());
	}
}
// File: cli.ts
import { Gateway } from "src/gateway";

(function run(): void {
	new Gateway().replace_behavior();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface GatewayContract {
	send(): string;
}

// File: src/in_memory_gateway.ts
import type { GatewayContract } from "src/protocols";

export class InMemoryGateway implements GatewayContract {
	private readonly _response: string;
	private readonly _label: string;
	private readonly _prefix: string;
	public constructor(label: string, response: string, prefix: string) {
		this._label = label;
		this._response = response;
		this._prefix = prefix;
	}
	public send(): string {
		const label = this._label.trim();
		const response = this._response.trim();
		if (label.length === 0) {
			return `${this._prefix}: unavailable`;
		}
		if (response.length === 0) {
			return `${this._prefix}: ${label}: unavailable`;
		}
		return `${this._prefix}: ${label}: ${response}`;
	}
}

// File: src/gateway_application.ts
import { InMemoryGateway } from "src/in_memory_gateway";
import type { GatewayContract } from "src/protocols";

export class GatewayApplication {
	private readonly _gateway: GatewayContract;
	public constructor(label: string, payload: string, prefix: string) {
		this._gateway = new InMemoryGateway(label, payload, prefix);
	}
	public response(): string {
		const response = this._gateway.send();
		if (response.length === 0) {
			return "No gateway response";
		}
		return response;
	}
	public status(): string {
		const response = this.response();
		if (response.length > 0) {
			return "ready";
		}
		return "unavailable";
	}
	public report(): void {
		const status = this.status();
		const response = this.response();
		console.log(`${status}: ${response}`);
	}
}
// File: cli.ts
import { GatewayApplication } from "src/gateway_application";

(function run(): void {
	const application = new GatewayApplication("Example gateway", "response payload", "Local");
	application.report();
})();
```
