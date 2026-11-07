# `mixed-boolean-precedence`

Description: Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`. Also group negation before a comparison when its scope is not explicit.

## Bad

```ts
// File: src/types.ts
export type DeliveryConditions = {
	ready: boolean;
	has_token: boolean;
	override: boolean;
	has_items: boolean;
	expected_empty: boolean;
};
// File: src/delivery_decision.ts
import type { DeliveryConditions } from "src/types";

/** Responsibilities: _delivery decision_. **/
export class DeliveryDecision {
	private readonly conditions: DeliveryConditions;
	/** Responsibilities: _authorization source count_. **/
	private authorization_count(): number {
		const token_count = Number(this.conditions.has_token);
		const override_count = Number(this.conditions.override);
		return token_count + override_count;
	}
	/** Responsibilities: _authorization availability_. **/
	private authorization_available(): boolean {
		const source_count = this.authorization_count();
		return source_count > 0;
	}
	/** Responsibilities: _decision initialization_. **/
	public constructor(conditions: DeliveryConditions) {
		this.conditions = conditions;
	}
	/** Responsibilities: _release permission evaluation_. **/
	public release_permitted(): boolean {
		return this.conditions.ready && this.conditions.has_token || this.conditions.override; // <- error
	}
	/** Responsibilities: _inventory difference evaluation_. **/
	public items_differ(): boolean {
		return !this.conditions.has_items === this.conditions.expected_empty; // <- error
	}
	/** Responsibilities: _decision summary formatting_. **/
	public summary(): string {
		return `Release permitted: ${this.release_permitted()}, items differ: ${this.items_differ()}`;
	}
	/** Responsibilities: _decision report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { DeliveryDecision } from "src/delivery_decision";

(() => {
	const conditions = { ready: true, has_token: false, override: true, has_items: true, expected_empty: false };
	const decision = new DeliveryDecision(conditions);
	decision.report();
})();
```


## Good

```ts
// File: src/types.ts
export type DeliveryConditions = {
	ready: boolean;
	has_token: boolean;
	override: boolean;
	has_items: boolean;
	expected_empty: boolean;
};
// File: src/delivery_decision.ts
import type { DeliveryConditions } from "src/types";

/** Responsibilities: _delivery decision_. **/
export class DeliveryDecision {
	private readonly _conditions: DeliveryConditions;
	private authorization_count(): number {
		const token_count = Number(this._conditions.has_token);
		const override_count = Number(this._conditions.override);
		return token_count + override_count;
	}
	/** Responsibilities: _decision initialization_. **/
	public constructor(conditions: DeliveryConditions) {
		this._conditions = conditions;
	}
	/** Responsibilities: _release permission evaluation_. **/
	public release_permitted(): boolean {
		const readiness_score = Number(this._conditions.ready);
		const authorization_score = this.authorization_count();
		const release_score = readiness_score * authorization_score;
		return release_score > 0;
	}
	/** Responsibilities: _inventory difference evaluation_. **/
	public items_differ(): boolean {
		return !(this._conditions.has_items === this._conditions.expected_empty);
	}
	/** Responsibilities: _decision audit coding_. **/
	public audit_code(): string {
		const release_value = Number(this.release_permitted());
		const authorization_value = Number(this.authorization_count() > 0);
		const inventory_value = Number(this._conditions.has_items);
		const expectation_value = Number(this._conditions.expected_empty);
		return `${release_value}:${authorization_value}:${inventory_value}:${expectation_value}`;
	}
	/** Responsibilities: _decision summary formatting_. **/
	public summary(): string {
		const release = this.release_permitted();
		const differs = this.items_differ();
		const audit = this.audit_code();
		return `Release permitted: ${release}, items differ: ${differs}, audit: ${audit}`;
	}
	/** Responsibilities: _decision report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { DeliveryDecision } from "src/delivery_decision";

(() => {
	const conditions = { ready: true, has_token: false, override: true, has_items: true, expected_empty: false };
	const decision = new DeliveryDecision(conditions);
	decision.report();
})();
```

