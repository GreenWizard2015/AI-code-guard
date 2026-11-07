# repeated-literal

Description: Production code should not repeat the same non-trivial string literal two or
more times.

Bad:

```ts
function report(): void {
  write("connection is unavailable");
  log("connection is unavailable");
  throw new Error("connection is unavailable");
}
```

Name the shared value or domain error once. If a matching project constant already
exists, every literal occurrence is reported as a use-the-constant violation,
even when it occurs only once. Otherwise, two or more production occurrences
are reported as a request to introduce a constant. The rule ignores strings
shorter than eight characters, standalone documentation strings, and test
files. Strings used as arguments or nested object, array, and collection values
are included at every depth.

## Bad

```ts
// File: src/connection_notice.ts
/** Responsibilities: _connection status reporting_. **/
export class ConnectionNotice {
	private readonly channel: string;
	/** Responsibilities: _notice initialization_. **/
	public constructor(channel: string) {
		this.channel = channel;
	}
	/** Responsibilities: _channel label normalization_. **/
	public channel_label(): string {
		const normalized = this.channel.trim();
		if (normalized.length === 0) { return "Unknown channel"; }
		return normalized.toUpperCase();
	}
	/** Responsibilities: _service status formatting_. **/
	public service_message(): string {
		return "connection is unavailable"; // <- error
	}
	/** Responsibilities: _operator status formatting_. **/
	public operator_message(): string {
		return "connection is unavailable";
	}
	/** Responsibilities: _connection summary formatting_. **/
	public summary(): string {
		return `${this.channel_label()}: ${this.service_message()} | ${this.operator_message()}`;
	}
	/** Responsibilities: _connection report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ConnectionNotice } from "src/connection_notice";

(() => {
	const notice = new ConnectionNotice("Primary");
	notice.report();
})();
```


## Good

```ts
// File: src/constants.ts
export const CONNECTION_UNAVAILABLE_MESSAGE = "connection is unavailable";
// File: src/connection_notice.ts
import { CONNECTION_UNAVAILABLE_MESSAGE } from "src/constants";

/** Responsibilities: _connection status reporting_. **/
export class ConnectionNotice {
	private readonly _messages: string[];
	private readonly _channel: string;
	/** Responsibilities: _notice initialization_. **/
	public constructor(channel: string) {
		this._channel = channel;
		this._messages = [];
	}
	/** Responsibilities: _channel label normalization_. **/
	public channel_label(): string {
		const normalized = this._channel.trim();
		if (normalized.length === 0) { return "Unknown channel"; }
		return normalized.toUpperCase();
	}
	/** Responsibilities: _service status formatting_. **/
	public service_message(): string {
		this._messages.push(CONNECTION_UNAVAILABLE_MESSAGE);
		return CONNECTION_UNAVAILABLE_MESSAGE;
	}
	/** Responsibilities: _operator status formatting_. **/
	public operator_message(): string {
		this._messages.push(CONNECTION_UNAVAILABLE_MESSAGE);
		return CONNECTION_UNAVAILABLE_MESSAGE;
	}
	/** Responsibilities: _connection summary formatting_. **/
	public summary(): string {
		const channel = this.channel_label();
		this.service_message();
		this.operator_message();
		const notices = this._messages.splice(0, this._messages.length);
		return `${channel}: ${notices.join(" | ")}`;
	}
	/** Responsibilities: _connection report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ConnectionNotice } from "src/connection_notice";

(() => {
	const notice = new ConnectionNotice("Primary");
	notice.report();
})();
```

