# `unused-type`

Description: Reports a type declaration with no production symbol usage. Test-only references
do not keep a production type alive.

## Bad

```ts
// File: src/types.ts
export type MessageStatus = "queued" | "delivered"; // <- error
// File: src/message_status_reporter.ts
/** Responsibilities: _message status reporting_. **/
export class MessageStatusReporter {
	private readonly status: string;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(status: string) {
		this.status = status;
	}
	/** Responsibilities: _status normalization_. **/
	public normalized_status(): string {
		return this.status.trim().toLowerCase();
	}
	/** Responsibilities: _status labeling_. **/
	public status_label(): string {
		return `Message status: ${this.normalized_status()}`;
	}
	public status_code(): number {
		const codes = new Map<string, number>([["queued", 10], ["delivered", 20]]);
		const code = codes.get(this.normalized_status());
		return code ?? 0;
	}
	public is_delivered(): boolean {
		return this.normalized_status() === "delivered";
	}
	public status_summary(): string {
		return `${this.status_label()} [${this.status_code()}]`;
	}
	/** Responsibilities: _status output_. **/
	public report(): void {
		console.log(`${this.status_summary()} delivered=${this.is_delivered()}`);
	}
}
// File: cli.ts
import { MessageStatusReporter } from "src/message_status_reporter";

(() => {
	const reporter = new MessageStatusReporter("queued");
	reporter.report();
})();
```


## Good

```ts
// File: src/types.ts
export type MessageStatus = "queued" | "delivered";
// File: src/message_status_reporter.ts
import type { MessageStatus } from "src/types";

/** Responsibilities: _message status reporting_. **/
export class MessageStatusReporter {
	private readonly _status: MessageStatus;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(status: MessageStatus) {
		this._status = status;
	}
	/** Responsibilities: _status normalization_. **/
	public normalized_status(): string {
		return this._status.trim().toLowerCase();
	}
	/** Responsibilities: _status labeling_. **/
	public status_label(): string {
		return `Message status: ${this.normalized_status()}`;
	}
	/** Responsibilities: _status character measurement_. **/
	public status_character_count(): number {
		const normalized = this.normalized_status();
		return normalized.length;
	}
	/** Responsibilities: _status summary composition_. **/
	public status_summary(): string {
		return `${this.status_label()} (${this.status_character_count()} characters)`;
	}
	/** Responsibilities: _status output_. **/
	public report(): void {
		console.log(this.status_summary());
	}
}
// File: cli.ts
import { MessageStatusReporter } from "src/message_status_reporter";

(() => {
	const reporter = new MessageStatusReporter("queued");
	reporter.report();
})();
```

