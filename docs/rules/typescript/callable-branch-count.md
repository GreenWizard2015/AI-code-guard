# `callable-branch-count`

Description: Named production callables should not accumulate more than ten independent
branch points. The metric counts `if`, loops, conditional expressions, switch
clauses, and catch branches. Nested callables are measured separately; tests
are excluded.

Move repeated value-to-result decisions into a lookup when that keeps the
mapping clear. Keep legitimate branching when it is one cohesive algorithm and
remains below the limit.

## Bad

The callable itself exceeds the branch limit:

```ts
{% const statuses = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo"] %}
// File: src/status_resolver.ts
export class StatusResolver {
	public resolve_value(flags: ReadonlySet<string>): string {
{%for status in statuses %}
		if (flags.has("{{status}}")) { return "{{status}}"; }
{% endfor %}
		return "Unknown";
	}
	public report(): void {
		console.log(this.resolve_value(new Set(["alpha"])));
	}
}
// File: cli.ts
import { StatusResolver } from "src/status_resolver";
(() => {
	const resolver = new StatusResolver();
	resolver.report();
})();
```


## Good

The lookup preserves the same eleven mappings, priority order, and fallback.

```ts
{% const statuses = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo"] %}
// File: src/status_labels.ts
/** Responsibilities: _status label collection_. **/
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _status label initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _single status lookup_. **/
	public label_for_status(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _priority status resolution_. **/
	public resolve_value(flags: ReadonlySet<string>): string {
		for (const status of this._labels.keys()) {
			if (flags.has(status)) {
				return this.label_for_status(status);
			}
		}
		return this._fallback;
	}

	/** Responsibilities: _available status-label counting_. **/
	public label_count(): number {
		let count = 0;
		for (const label of this._labels.values()) {
			if (label.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _status resolution report_. **/
	public report(): void {
		const flags = new Set<string>(["alpha"]);
		const label = this.resolve_value(flags);
		const fallback = this.label_for_status("unknown");
		console.log(`${label} ${fallback} ${this.label_count()}`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
{%for status in statuses %}
	labels.set("{{status}}", "{{status}}");
{% endfor %}
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```

