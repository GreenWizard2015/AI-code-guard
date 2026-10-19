# responsibilities-wording

Description: Keep each responsibility as a concise ownership phrase rather than a description of
results or invocation mechanics.

Each responsibility may contain at most four words. Use a noun phrase that names the owned work,
not a verb phrase describing an outcome, a condition, or an invocation. Articles and inflected
action words are strong signals that the phrase is describing execution instead of ownership.

Examples:

- Outcome-oriented: `_produces direct parity results_` → `_parity result construction_`.
- Condition-oriented: `_determines whether paths match_` → `_path matching_`.
- Invocation-oriented: `_invokes reference handlers_` → `_reference handler dispatch_`.

The left side describes what happens during execution. The right side names the responsibility
itself, so it remains short, stable, and focused on ownership. Prefer phrases such as
`_user validation_`, `_record lookup_`, `_array type detection_`, and `_file-name suffix_`.

Do not remove meaningful ownership details merely to meet the limit. When the responsibility cannot
be stated honestly in four words without describing a result or invocation, split the owner or
choose a more direct domain phrase.

## Bad

```ts
// File: src/parity_result.ts
/** Responsibilities: _parity construction_, _text access_. **/
export class ParityResult {
	private readonly result_text: string;
	/** Responsibilities: _result initialization_. **/
	public constructor(result_text: string) { this.result_text = result_text; }
	/** Responsibilities: _normalizes direct parity results_. **/
	public text(): string {
		let normalized_text = "";
		for (const word of this.result_text.split(/\s+/u)) {
			if (word.length > 0) {
				if (normalized_text.length > 0) { normalized_text += " "; }
				normalized_text += word;
			}
		}
		return normalized_text;
	}
	/** Responsibilities: _text length_. **/
	public text_length(): number {
		let length = 0;
		for (const character of this.result_text) {
			if (!/\s/u.test(character)) { length += 1; }
		}
		return length;
	}
	/** Responsibilities: _word count_. **/
	public word_count(): number { const words = this.text().split(" "); return words.length; }
	/** Responsibilities: _uppercase text_. **/
	public uppercase_text(): string { const text = this.text(); return text.toUpperCase(); }
}
// File: cli.ts
import { ParityResult } from "src/parity_result";
(function () {
	const first_result = new ParityResult("ready state");
	const second_result = new ParityResult("blocked state");
	first_result.text();
	first_result.text_length();
	first_result.word_count();
	first_result.uppercase_text();
	second_result.text();
	second_result.text_length();
	second_result.word_count();
	second_result.uppercase_text();
})();
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
