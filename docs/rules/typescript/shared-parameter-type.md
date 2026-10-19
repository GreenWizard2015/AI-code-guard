# `shared-parameter-type`

Description: Repeated use of one project reference type can signal behavior that belongs at a
shared domain boundary. Treat the diagnostic as a refactoring prompt, not an automatic request for
a wrapper.

Top-level functions are grouped project-wide; methods are grouped only within their declaring
class. Test and private methods do not count. Primitive parameters alone do not trigger this rule.
Resolve aliases and inspect all callers before moving behavior.

## Bad

Four operations repeatedly accept the same endpoint and separately interpret its data.

```ts
// File: src/endpoint.ts
export class Endpoint {
	public readonly scheme: string;
	public readonly host: string;
	public readonly path: string;
	public constructor(scheme: string, host: string, path: string) {
		this.scheme = scheme;
		this.host = host;
		this.path = path;
	}
}
// File: src/endpoint_operations.ts
import { Endpoint } from "src/endpoint";
export function endpoint_origin(endpoint: Endpoint): string {
	return `${endpoint.scheme.toLowerCase()}://${endpoint.host.toLowerCase()}`;
}
export function endpoint_host(endpoint: Endpoint): string {
	return endpoint.host.toLowerCase();
}
export function endpoint_path(endpoint: Endpoint): string {
	return endpoint.path.trim().replace(/\/+$/u, "");
}
export function endpoint_secure(endpoint: Endpoint): boolean {
	return endpoint.scheme.toLowerCase() === "https";
}
// File: cli.ts
#!/usr/bin/env node
import { Endpoint } from "src/endpoint";
import { endpoint_host, endpoint_origin, endpoint_path, endpoint_secure } from "src/endpoint_operations";
(function () {
	const endpoint = new Endpoint("HTTPS", "example.test", "/api/");
	console.log(endpoint_origin(endpoint), endpoint_host(endpoint), endpoint_path(endpoint), endpoint_secure(endpoint));
})();
```


## Good

Move those operations onto the value they interpret. The same inputs produce the same outputs;
callers no longer pass `Endpoint` repeatedly.

```ts
// File: src/endpoint.ts
/** Responsibilities: _endpoint state and interpretation_. **/
export class Endpoint {
	public readonly scheme: string;
	public readonly host: string;
	public readonly path: string;
	public constructor(scheme: string, host: string, path: string) {
		this.scheme = scheme.toLowerCase();
		this.host = host.toLowerCase();
		this.path = path.trim();
	}
	public origin(): string {
		return `${this.scheme}://${this.host}`;
	}
	public normalized_path(): string {
		let path = this.path;
		while (path.endsWith("/")) { path = path.slice(0, -1); }
		return path;
	}
	public secure(): boolean { return this.scheme === "https"; }
}
// File: cli.ts
#!/usr/bin/env node
import { Endpoint } from "src/endpoint";
(function () {
	const endpoint = new Endpoint("HTTPS", "example.test", "/api/");
	console.log(endpoint.origin(), endpoint.host, endpoint.normalized_path(), endpoint.secure());
})();
```

