# `unknown-parameter-type`

Description: Do not accept TypeScript `unknown` as a parameter type.

## Bad

```ts
// File: src/value_parser.ts
export class ValueParser {
	private readonly fallback: string;
	public constructor(fallback: string) {
		this.fallback = fallback;
	}
	public parse(value: unknown): string {
		const normalized_value = String(value).trim();
		if (normalized_value.length === 0) {
			return this.fallback;
		}
		return normalized_value.toUpperCase();
	}
	public report(): void {
		console.log(this.parse("ready"));
	}
}
// File: cli.ts
import { ValueParser } from "src/value_parser";
(function () {
	const parser = new ValueParser("unavailable");
	parser.report();
})();
```

Fix: Define the concrete input contract or a focused protocol at the boundary.

## Good

```ts
// File: src/protocols.ts
export type SubmissionData = {
	readonly text: string;
	readonly source: string;
};
// File: src/text_submission.ts
import type { SubmissionData } from "src/protocols";

export class TextSubmission {
	private readonly _submission: SubmissionData;
	public constructor(submission: SubmissionData) {
		this._submission = submission;
	}
	public display_text(): string {
		const words = this._submission.text.trim().split(/\s+/u);
		const formatted_words: string[] = [];
		for (const word of words) {
			formatted_words.push(word.toLowerCase());
		}
		return formatted_words.join(" ");
	}
	public source_heading(): string {
		const source = this._submission.source.trim();
		const first_letter = source.slice(0, 1).toUpperCase();
		const remaining_letters = source.slice(1).toLowerCase();
		return `${first_letter}${remaining_letters}`;
	}
	public description(): string {
		const content = this.display_text();
		const word_count = content.split(/\s+/u).length;
		const character_count = this._submission.text.trim().length;
		return `${this.source_heading()}: ${content} (${word_count} words, ${character_count} characters)`;
	}
	public report(): void {
		console.log(this.description());
	}
}
// File: cli.ts
import { TextSubmission } from "src/text_submission";
import type { SubmissionData } from "src/protocols";
(function () {
	const input: SubmissionData = { text: "ready", source: "terminal" };
	const submission = new TextSubmission(input);
	submission.report();
})();
```
