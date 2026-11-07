# `bare-type-alias`

Description: Renaming one existing type does not create a useful boundary and obscures ownership.

```ts
export type RelayReactionValue = ReactionInput;
```


Fix: Use `ReactionInput` directly, or define a distinct interface, object shape, or
wrapper with its own contract. A generic alias whose RHS is its type parameter, such as
`type Identity<T> = T`, is allowed.

## Bad

```ts
// File: src/types.ts
export type ReactionInput = { text: string };
export type RelayReactionValue = ReactionInput; // <- error
// File: src/reaction_envelope.ts
import type { RelayReactionValue } from "src/types";

/** Responsibilities: _reaction envelope_. **/
export class ReactionEnvelope {
	private readonly input: RelayReactionValue;
	/** Responsibilities: _envelope initialization_. **/
	public constructor(input: RelayReactionValue) {
		this.input = input;
	}
	/** Responsibilities: _reaction text normalization_. **/
	public normalized_text(): string {
		const trimmed_text = this.input.text.trim();
		const normalized_text = trimmed_text.replace(/\s+/gu, " ");
		return normalized_text;
	}
	/** Responsibilities: _reaction label formatting_. **/
	public label(): string {
		return `Reaction: ${this.normalized_text()}`;
	}
	/** Responsibilities: _reaction report output_. **/
	public report(): void {
		console.log(this.label());
	}
}
// File: cli.ts
import { ReactionEnvelope } from "src/reaction_envelope";

(() => {
	const reaction = new ReactionEnvelope({ text: "approved" });
	reaction.report();
})();
```

## Good

```ts
// File: src/types.ts
export type ReactionInput = { text: string };
// File: src/reaction_envelope.ts
import type { ReactionInput } from "src/types";

/** Responsibilities: _reaction envelope_. **/
export class ReactionEnvelope {
	private readonly _input: ReactionInput;
	/** Responsibilities: _envelope initialization_. **/
	public constructor(input: ReactionInput) {
		this._input = input;
	}
	/** Responsibilities: _reaction text normalization_. **/
	public normalized_text(): string {
		const normalized = this._input.text.normalize("NFC").trim();
		return normalized.replace(/\s+/gu, " ");
	}
	/** Responsibilities: _reaction word counting_. **/
	public word_count(): number {
		const words = this._input.text.trim().split(/\s+/u);
		if (words.length === 1 && words[0] === "") { return 0; }
		return words.length;
	}
	/** Responsibilities: _reaction character counting_. **/
	public character_count(): number {
		const trimmed_text = this._input.text.trim();
		const compact_text = trimmed_text.replace(/\s+/gu, " ");
		return compact_text.length;
	}
	/** Responsibilities: _reaction label formatting_. **/
	public label(): string {
		const normalized_text = this.normalized_text();
		const word_count = this.word_count();
		const character_count = this.character_count();
		return `Reaction: ${normalized_text} (${word_count} words, ${character_count} characters)`;
	}
	/** Responsibilities: _reaction report output_. **/
	public report(): void {
		console.log(`${this.label()} | ${this.word_count()} words`);
	}
}
// File: cli.ts
import { ReactionEnvelope } from "src/reaction_envelope";

(() => {
	const reaction = new ReactionEnvelope({ text: "approved" });
	reaction.report();
})();
```
