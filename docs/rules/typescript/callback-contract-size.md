# `callback-contract-size`

Description: Keep callback contracts to three or fewer parameters. A named TypeScript function
type or callback field, and a Python `Callable` parameter, is reported when it
accepts more than three values. Ordinary methods and functions are not measured.

Replace a multi-role callback with a named interface, protocol, or event object.

## Bad

```ts
// File: src/member_change_publisher.ts
export type MemberChanged = (owner: string, name: string, before: string, after: string) => void;

export class MemberChangePublisher {
	private readonly owner: string;
	private readonly callback: MemberChanged;

	public constructor(owner: string, callback: MemberChanged) {
		this.owner = owner;
		this.callback = callback;
	}

	public publish(name: string, before: string, after: string): void {
		const normalized_name = name.trim();
		this.callback(this.owner, normalized_name, before, after);
	}

	public summary(name: string, before: string, after: string): string {
		const member = name.trim();
		const previous = before.trim();
		const current = after.trim();
		return `${this.owner}.${member}: ${previous} -> ${current}`;
	}

	public report(name: string, before: string, after: string): void {
		this.publish(name, before, after);
		const event_summary = this.summary(name, before, after);
		console.log(event_summary);
	}
}
// File: cli.ts
import { MemberChangePublisher } from "src/member_change_publisher";

(() => {
	const publisher = new MemberChangePublisher("owner-1", () => {});
	publisher.report("display_name", "Old", "New");
})();
```


## Good

```ts
// File: src/member_changed_event.ts
/** Responsibilities: _member change event_. **/
export class MemberChangedEvent {
	private readonly _owner: string;
	private readonly _name: string;
	private readonly _before: string;
	private readonly _after: string;

	/** Responsibilities: _event construction_. **/
	public constructor(owner: string, name: string, before: string, after: string) {
		this._owner = owner;
		this._name = name;
		this._before = before;
		this._after = after;
	}

	/** Responsibilities: _owner label formatting_. **/
	public owner_label(): string {
		if (this._owner.trim().length === 0) {
			return "Unknown owner";
		}
		const normalized_owner = this._owner.trim();
		return normalized_owner.toUpperCase();
	}

	/** Responsibilities: _member label formatting_. **/
	public member_label(): string {
		const normalized_name = this._name.trim();
		return normalized_name.replaceAll("_", " ");
	}

	/** Responsibilities: _value transition formatting_. **/
	public transition_label(): string {
		const previous = this._before.trim();
		const current = this._after.trim();
		return `${previous} -> ${current}`;
	}

	/** Responsibilities: _member change output_. **/
	public report(): void {
		const owner = this.owner_label();
		const member = this.member_label();
		const transition = this.transition_label();
		console.log(`${owner}.${member}: ${transition}`);
	}
}
// File: cli.ts
import { MemberChangedEvent } from "src/member_changed_event";

(() => {
	const event = new MemberChangedEvent("owner-1", "display_name", "Old", "New");
	event.report();
})();
```

