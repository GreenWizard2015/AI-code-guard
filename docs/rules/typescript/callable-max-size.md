# `callable-max-size`

Description: Detect functions and methods whose implementation is too large to remain one focused
operation.


Fix: Extract a cohesive operation or move behavior to its owning collaborator. Check callers and
preserve state ownership; do not create arbitrary forwarding helpers.

Size averages callable-body lines and executable SLOC, excluding signatures and Python docstrings.
The separate 100-significant-character limit ignores whitespace.

## Bad

```ts
// File: src/content_record.ts
export class ContentRecord {
	private readonly name: string;
	private readonly content: string;

	private word_count(): number {
		return this.content.trim().split(/\s+/u).filter(Boolean).length;
	}

	public constructor(name: string, content: string) {
		this.name = name;
		this.content = content;
	}

	public describe_value(): string { // <- error
		{% const descriptions = [{"term":"alpha","value":"first"},{"term":"beta","value":"second"},{"term":"gamma","value":"third"},{"term":"delta","value":"fourth"},{"term":"epsilon","value":"fifth"},{"term":"zeta","value":"sixth"},{"term":"eta","value":"seventh"}] %}
		{%for item in descriptions %}
		if (this.content.includes("{{item.term}}")) {
			return "{{item.value}}";
		}
		{% endfor %}
		return "other";
	}

	public summary(): string {
		const count = this.word_count();
		return `${this.name} (${count} words)`;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("notes.txt", "alpha beta gamma delta epsilon");
	console.log(record.describe_value(), record.summary());
})();
```

## Good

```ts
// File: src/content_record.ts
/** Responsibilities: _content record state_. **/
export class ContentRecord {
	private readonly name: string;
	private readonly content: string;
	private readonly descriptions: ReadonlyMap<string, string>;

	/** Responsibilities: _record initialization_. **/
	public constructor(name: string, content: string) {
		this.name = name;
		this.content = content;
		this.descriptions = new Map([
			["alpha", "first"],
			["beta", "second"],
			["gamma", "third"],
			["delta", "fourth"],
			["epsilon", "fifth"],
			["zeta", "sixth"],
			["eta", "seventh"],
		]);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		return this.content.trim().split(/\s+/u).filter(Boolean).length;
	}

	/** Responsibilities: _value description_. **/
	public describe_value(): string {
		for (const [term, description] of this.descriptions) {
			if (this.content.includes(term)) {
				return description;
			}
		}
		return "other";
	}

	/** Responsibilities: _record summary_. **/
	public summary(): string {
		const count = this.word_count();
		return `${this.name} (${count} words)`;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("notes.txt", "alpha beta gamma delta epsilon");
	console.log(record.describe_value(), record.word_count(), record.summary());
})();
```
