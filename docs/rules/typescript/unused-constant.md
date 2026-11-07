# `unused-constant`

Description: Reports a module-level constant with no production symbol usage. Remove dead
configuration or vocabulary, or add a real production consumer.

## Bad

```ts
// File: src/constants.ts
export const READ_FAILURE_MESSAGE = "request processing failed"; // <- error
// File: src/read_failure_reporter.ts
export class ReadFailureReporter {
	private readonly _source_path: string;
	private normalized_source_label(): string {
		const normalized_path = this._source_path.trim().replaceAll("\\", "/");
		if (normalized_path.length === 0) {
			return "unknown source";
		}
		const source_label = normalized_path.slice(normalized_path.lastIndexOf("/") + 1);
		if (source_label.length === 0) {
			return "unknown source";
		}
		return source_label.toLowerCase();
	}
	public constructor(source_path: string) {
		this._source_path = source_path;
	}
	public report(): void {
		const source_label = this.normalized_source_label();
		const fields = ["Read failure", `source=${source_label}`];
		console.log(fields.join(" | "));
	}
}
// File: cli.ts
import { ReadFailureReporter } from "src/read_failure_reporter";
(function run(): void {
	const reporter = new ReadFailureReporter("/var/data/queue.txt");
	reporter.report();
})();
```


## Good

```ts
// File: src/constants.ts
export const READ_FAILURE_MESSAGE = "request processing failed";
// File: src/read_failure_reporter.ts
import { READ_FAILURE_MESSAGE } from "src/constants";

export class ReadFailureReporter {
	private readonly _source_name: string;
	private readonly _failure_sources: string[];

	public constructor(source_name: string) {
		this._source_name = source_name;
		this._failure_sources = [];
	}

	public record_failure(source_path: string): void {
		const normalized_path = source_path.trim().replaceAll("\\", "/").toLowerCase();
		if (normalized_path.length === 0) {
			return;
		}
		const source_label = normalized_path.slice(normalized_path.lastIndexOf("/") + 1);
		if (source_label.length > 0) {
			this._failure_sources.push(source_label);
		}
	}

	public failure_message(): string {
		if (this._failure_sources.length === 0) {
			return READ_FAILURE_MESSAGE;
		}
		const source_names = this._failure_sources.join(", ");
		return `${source_names}: ${READ_FAILURE_MESSAGE} (${this._failure_sources.length})`;
	}

	public report(): void {
		const message = this.failure_message();
		const source_context = `Source ${this._source_name.trim()}`;
		const report_line = [message, source_context].join(" | ");
		console.log(report_line);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { ReadFailureReporter } from "src/read_failure_reporter";

(function run(): void {
	const reporter = new ReadFailureReporter("queue");
	reporter.record_failure("/var/data/queue.txt");
	reporter.report();
})();
```

