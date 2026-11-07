# `function-placement`

Description: Keep production behavior in domain classes, not module-level free functions.
The exact project-root `functions.{ext}` file is not an exemption: it may hold
focused domain classes, but free functions there are reported by
`functions-file-domain-class`. A CLI may contain one entry point; keep startup
code inline in `cli.{ext}`.

## Bad

```ts
// File: src/worker.ts
export function resolve_status(status: string): string {
	return status.toUpperCase();
}
// File: src/status_reporter.ts
export class StatusReporter {
	public report(status: string): void {
		console.log(`Status: ${status}`);
	}
}
// File: cli.ts
import { StatusReporter } from "src/status_reporter";
import { resolve_status } from "src/worker";
(function () {
	const resolved_status = resolve_status("ready");
	const reporter = new StatusReporter();
	reporter.report(resolved_status);
})();
```


## Good

```ts
// File: src/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _status report output_. **/
	public report(): void {
		const lines = [
			this.label("ready"),
			this.label_with_prefix("State", "ready"),
			this.uppercase_fallback(),
			String(this.status_count()),
		];
		console.log(lines.join(" | "));
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";

(function () {
	const labels = new Map<string, string>([["ready", "Ready"]]);
	const owner = new StatusLabels(labels, "Unknown");
	owner.report();
})();
```
