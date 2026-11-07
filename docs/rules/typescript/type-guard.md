# Type guards

Description: Keep project state transitions explicit instead of hiding them in a
TypeScript return predicate.

**Diagnostic:** `typescript-type-guard`

**Example:**

```ts
function is_user(value: unknown): value is User {
  return value instanceof User;
}
```


Fix: Return an explicit result or use a dedicated class/protocol boundary.
Do not use return types of the form `value is Type` for project behavior.

For primitive external input, use one `typeof` check at the boundary, return the
explicit domain type, and avoid repeating runtime checks in business logic.

## Bad

```ts
// File: src/text_classifier.ts
export class TextClassifier {
	private readonly candidate: unknown;

	public constructor(candidate: unknown) {
		this.candidate = candidate;
	}

	public is_text(value: unknown): value is string {
		return typeof value === "string";
	}

	public normalized_text(): string {
		const candidate = this.candidate;
		if (this.is_text(candidate)) {
			const words = candidate.trim().split(/\s+/u);
			return words.join(" ");
		}
		return "unavailable";
	}

	public summary(): string {
		const normalized = this.normalized_text();
		const length = normalized.length;
		return `${normalized} (${length} characters)`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { TextClassifier } from "src/text_classifier";

(function run(): void {
	const classifier = new TextClassifier("ready state");
	classifier.report();
})();
```

## Good

```ts
// File: src/text_report.ts
export class TextReport {
	private readonly _source_text: string;

	public constructor(source_text: string) {
		this._source_text = source_text;
	}

	public normalized_text(): string {
		const words = this._source_text.trim().split(/\s+/u);
		return words.join(" ");
	}

	public word_count(): number {
		const normalized = this.normalized_text();
		if (this._source_text.trim().length === 0) {
			return 0;
		}
		return normalized.split(" ").length;
	}

	public summary(): string {
		const normalized = this.normalized_text();
		const count = this.word_count();
		return `${normalized} (${count} words)`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { TextReport } from "src/text_report";

(function run(): void {
	const report = new TextReport("ready state");
	report.report();
})();
```
