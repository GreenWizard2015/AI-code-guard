# `exception-grouping`

Description: Keep a one-use exception beside the code that handles it.

## Bad

```ts
// File: src/network_error.ts
export class NetworkError extends Error {}
// File: src/network_report.ts
import { NetworkError } from "src/network_error";


export class NetworkReport {
	private readonly network_error: NetworkError;
	private reports_emitted: number;

	public constructor(network_error: NetworkError) {
		this.network_error = network_error;
		this.reports_emitted = 0;
	}

	public report_network_failure(): void {
		console.log(`network failure: ${this.network_error.message}`);
		this.reports_emitted += 1;
	}

	public reported_failure_count(): number {
		return this.reports_emitted;
	}

	public reset_report_count(): void {
		this.reports_emitted = 0;
	}
}
// File: cli.ts
import { NetworkError } from "src/network_error";
import { NetworkReport } from "src/network_report";

(function run(): void {
	const network_error = new NetworkError("offline");
	const reporter = new NetworkReport(network_error);
	reporter.report_network_failure();
	if (reporter.reported_failure_count() > 0) {
		reporter.reset_report_count();
	}
})();
```

## Good

```ts
// File: src/network_errors.ts
export class NetworkTimeoutError extends Error {}
export class NetworkUnavailableError extends Error {}
// File: src/network_report.ts
import {
	NetworkTimeoutError,
	NetworkUnavailableError,
} from "src/network_errors";

export class NetworkReport {
	private readonly _failures: Set<Error>;

	public constructor() {
		this._failures = new Set<Error>();
	}

	public report_network_failures(): void {
		const timeout_error = new NetworkTimeoutError("timed out");
		const unavailable_error = new NetworkUnavailableError("offline");
		this._failures.add(timeout_error);
		this._failures.add(unavailable_error);
		for (const error of this._failures) {
			console.log(`network failure: ${error.message}`);
		}
	}

	public failure_count(): number {
		return this._failures.size;
	}

	public reset_failures(): void {
		this._failures.clear();
	}
}
// File: cli.ts
import { NetworkReport } from "src/network_report";

(function run(): void {
	const reporter = new NetworkReport();
	reporter.report_network_failures();
	if (reporter.failure_count() > 0) {
		reporter.reset_failures();
	}
})();
```
