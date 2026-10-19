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
// File: functions.ts
export function resolve_value(flags: ReadonlySet<string>): string {
{%for status in statuses %}
	if (flags.has("{{status}}")) { return "{{status}}"; }
{% endfor %}
	return "Unknown";
}
```


## Good

The lookup preserves the same eleven mappings, priority order, and fallback.

```ts
{% const statuses = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo"] %}
// File: src/status_labels.ts
/** Responsibilities: _status label collection_. **/
export class StatusLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;

	/** Responsibilities: _status label initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this.labels = labels;
		this.fallback = fallback;
	}

	/** Responsibilities: _single status lookup_. **/
	public label_for_status(status: string): string {
		const label = this.labels.get(status);
		if (label === undefined) {
			return this.fallback;
		}
		return label;
	}

	/** Responsibilities: _priority status resolution_. **/
	public resolve_value(flags: ReadonlySet<string>): string {
		for (const status of this.labels.keys()) {
			if (flags.has(status)) {
				return this.label_for_status(status);
			}
		}
		return this.fallback;
	}

	/** Responsibilities: _available status-label counting_. **/
	public label_count(): number {
		let count = 0;
		for (const label of this.labels.values()) {
			if (label.length > 0) {
				count += 1;
			}
		}
		return count;
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
{%for status in statuses %}
	labels.set("{{status}}", "{{status}}");
{% endfor %}
	const flags = new Set<string>();
	flags.add("alpha");
	const status_labels = new StatusLabels(labels, "Unknown");
	const label = status_labels.resolve_value(flags);
	const fallback = status_labels.label_for_status("unknown");
	const count = status_labels.label_count();
	console.log(label, fallback, count);
})();
```

