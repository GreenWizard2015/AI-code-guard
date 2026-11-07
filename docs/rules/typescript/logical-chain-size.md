# `logical-chain-size`

Description: Logical conditions with more than three parts or at least 100 significant characters are difficult to name,
review, and reuse. The rule counts the operands in a connected TypeScript `&&`, `||`, or `??`
expression and Python `and` or `or` expression. A single operand is ignored because it is not a
logical chain. Significant characters are counted with the same whitespace-insensitive metric used by callable-size checks. Mixed nested logical operators are counted as one chain, and only the outer
expression is reported.

```ts
return has_name && has_type && is_active && is_visible;
```

### Fix

Extract the condition into a named boolean variable or a predicate method, then use that
name at the decision or return boundary.

```ts
const can_publish = has_name && has_type && is_active && is_visible;
return can_publish;
```


## Bad

```ts
// File: src/entry_policy.ts
/** Responsibilities: _entry permission decisions_. **/
export class EntryPolicy {
	private readonly identity: string;
	private readonly ticket: string;
	private readonly payment: string;
	private readonly term: string;
	/** Responsibilities: _identity validation_. **/
	private identity_valid(): boolean {
		const normalized_identity = this.identity.trim();
		const identity_length = normalized_identity.length;
		const identity_present = identity_length > 0;
		return identity_present;
	}
	/** Responsibilities: _booking validation_. **/
	private booking_valid(): boolean {
		const normalized_ticket = this.ticket.trim();
		const ticket_present = normalized_ticket.length > 0;
		const payment_current = this.payment === "paid";
		const term_current = this.term === "current";
		const payment_terms_valid = payment_current && term_current;
		const booking_complete = ticket_present && payment_terms_valid;
		return booking_complete;
	}
	/** Responsibilities: _policy initialization_. **/
	public constructor(identity: string, ticket: string, payment: string, term: string) {
		this.identity = identity;
		this.ticket = ticket;
		this.payment = payment;
		this.term = term;
	}
	/** Responsibilities: _entry permission evaluation_. **/
	public entry_permitted(): boolean {
		return this.identity.trim().length > 0 && this.ticket.trim().length > 0
			&& this.payment === "paid" && this.term === "current"; // <- error
	}
	/** Responsibilities: _entry status formatting_. **/
	public status_label(): string {
		return `Entry permitted: ${this.entry_permitted()}`;
	}
	/** Responsibilities: _entry status output_. **/
	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { EntryPolicy } from "src/entry_policy";

(() => {
	const policy = new EntryPolicy("Ada", "ticket-7", "paid", "current");
	policy.report();
})();
```


## Good

```ts
// File: src/entry_policy.ts
/** Responsibilities: _entry permission decisions_. **/
export class EntryPolicy {
	private readonly _identity: string;
	private readonly _ticket: string;
	private readonly _payment: string;
	private readonly _term: string;
	private identity_valid(): boolean {
		const normalized_identity = this._identity.trim();
		const identity_length = normalized_identity.length;
		return identity_length > 0;
	}
	private booking_valid(): boolean {
		const normalized_ticket = this._ticket.trim();
		const ticket_present = normalized_ticket.length > 0;
		const payment_current = this._payment === "paid";
		const term_current = this._term === "current";
		return ticket_present && payment_current && term_current;
	}
	/** Responsibilities: _policy initialization_. **/
	public constructor(identity: string, ticket: string, payment: string, term: string) {
		this._identity = identity;
		this._ticket = ticket;
		this._payment = payment;
		this._term = term;
	}
	/** Responsibilities: _entry permission evaluation_. **/
	public entry_permitted(): boolean {
		const identity_valid = this.identity_valid();
		const booking_valid = this.booking_valid();
		return identity_valid && booking_valid;
	}
	/** Responsibilities: _entry status formatting_. **/
	public status_label(): string {
		return `Entry permitted: ${this.entry_permitted()}`;
	}
	/** Responsibilities: _entry status output_. **/
	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { EntryPolicy } from "src/entry_policy";

(() => {
	const policy = new EntryPolicy("Ada", "ticket-7", "paid", "current");
	policy.report();
})();
```

