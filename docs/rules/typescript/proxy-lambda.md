# `proxy-lambda`

Description: Reject a lambda that only forwards its parameters, in any order, to a method of the current project-owned object.

Fix: Call the owning method directly or pass the owning object through the interface. The rule compares parameter references with forwarded argument references without requiring positional order or a special method name. Callbacks passed directly to external APIs, such as `HTMLElement.addEventListener`, are outside this rule because they are call arguments rather than object-property implementations.

## Bad

```ts
// File: src/protocols.ts
export interface DispatchContract {
	dispatch(expression: string, owner: string): string;
}
// File: src/status_dispatcher.ts
import type { DispatchContract } from "src/protocols";

export class StatusDispatcher implements DispatchContract {
	private readonly channel: string;
	public constructor(channel: string) {
		this.channel = channel;
	}
	public dispatch(expression: string, owner: string): string {
		const normalized_expression = expression.trim().toUpperCase();
		const normalized_owner = owner.trim().toLowerCase();
		return `${this.channel}:${normalized_owner}:${normalized_expression}`;
	}
	public create_proxy(): DispatchContract {
		return {
			dispatch: (expression, owner) => this.dispatch(owner, expression), // <- error
		};
	}
	public report(): void {
		const proxy = this.create_proxy();
		const result = proxy.dispatch("ready", "worker");
		console.log(result);
	}
}
// File: cli.ts
import { StatusDispatcher } from "src/status_dispatcher";
(function () {
	const dispatcher = new StatusDispatcher("queue");
	dispatcher.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface DispatchContract {
	dispatch(expression: string, owner: string): string;
}
// File: src/status_route.ts
import type { DispatchContract } from "src/protocols";

export class StatusRoute implements DispatchContract {
	private readonly _channel: string;
	private normalized_owner(owner_label: string): string {
		const normalized_owner = owner_label.trim().toLowerCase();
		if (normalized_owner.length === 0) {
			return "anonymous";
		}
		return normalized_owner;
	}
	public constructor(channel: string) {
		this._channel = channel;
	}
	public dispatch(expression: string, owner: string): string {
		const normalized_expression = expression.trim().toUpperCase();
		const normalized_owner = this.normalized_owner(owner);
		if (normalized_expression.length === 0) {
			return `${this._channel}:${normalized_owner}:empty`;
		}
		return `${this._channel}:${normalized_owner}:${normalized_expression}`;
	}
	public local_owner(candidate_owner: string): boolean {
		const normalized_owner = this.normalized_owner(candidate_owner);
		return normalized_owner.startsWith("worker");
	}
	public report(): void {
		const result = this.dispatch("ready", "worker");
		const owner_is_local = this.local_owner("worker");
		console.log(`${result} | local=${owner_is_local}`);
	}
}
// File: cli.ts
import { StatusRoute } from "src/status_route";
(function () {
	const route = new StatusRoute("queue");
	route.report();
})();
```
