# literal-constant-reuse

Description: Use an existing named constant when production code repeats its non-trivial
string value. The diagnostic is reported at each literal occurrence, including
when the value is used only once in the consuming callable.

Bad:

```ts
const CONNECTION_MESSAGE = "connection is unavailable";

function report(): void {
  write("connection is unavailable");
}
```

Good:

```ts
const CONNECTION_MESSAGE = "connection is unavailable";

function report(): void {
  write(CONNECTION_MESSAGE);
}
```

The rule applies to TypeScript and Python production code and ignores test
files and short strings.

## Bad

```ts
// File: src/constants.ts
export const CONNECTION_UNAVAILABLE_MESSAGE = "connection is unavailable";
// File: src/connection_notice.ts
import { CONNECTION_UNAVAILABLE_MESSAGE } from "src/constants";

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
		return CONNECTION_UNAVAILABLE_MESSAGE;
	}
	/** Responsibilities: _operator status formatting_. **/
	public operator_message(): string {
		return "connection is unavailable"; // <- error
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
	private readonly _channel: string;
	/** Responsibilities: _notice initialization_. **/
	public constructor(channel: string) {
		this._channel = channel;
	}
	/** Responsibilities: _channel label normalization_. **/
	public channel_label(): string {
		const normalized = this._channel.trim();
		if (this._channel.trim().length === 0) { return "Unknown channel"; }
		return normalized.toUpperCase();
	}
	/** Responsibilities: _service status formatting_. **/
	public service_message(): string {
		return CONNECTION_UNAVAILABLE_MESSAGE;
	}
	/** Responsibilities: _operator status formatting_. **/
	public operator_message(): string {
		return CONNECTION_UNAVAILABLE_MESSAGE;
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

