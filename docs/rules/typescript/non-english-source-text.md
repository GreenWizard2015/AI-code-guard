# `non-english-source-text`

Description: Production comments and string literals must use English. In test files, check comments only; test literals may use any language. Markdown and supported text-file prose is checked too. Non-Latin scripts, including Cyrillic and CJK ideographs, are detected; Latin accents are allowed.

## Bad

```ts
// File: src/localization_catalog.ts
/** Responsibilities: _localized message lookup_. **/
export class LocalizationCatalog {
	private readonly messages: ReadonlyMap<string, string>;
	private readonly fallback: string;
	public constructor(messages: ReadonlyMap<string, string>, fallback: string) {
		this.messages = messages;
		this.fallback = fallback;
	}
	public message(message_id: string): string {
		const message = this.messages.get(message_id);
		if (message === undefined) { return this.fallback; }
		return message;
	}
	public message_with_context(context_label: string, contextual_id: string): string {
		return `${context_label}: ${this.message(contextual_id)}`;
	}
	public normalized_fallback(): string {
		return this.fallback.trim().toUpperCase();
	}
	public message_count(): number {
		let count = 0;
		for (const key of this.messages.keys()) {
			if (key.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const welcome = this.message("welcome");
		const contextual = this.message_with_context("Status", "welcome");
		const fallback = this.normalized_fallback();
		console.log(`${welcome} | ${contextual} | ${fallback} (${this.message_count()} messages)`);
	}
}
// File: cli.ts
import { LocalizationCatalog } from "src/localization_catalog";
(function () {
	const messages = new Map<string, string>();
	messages.set("welcome", "Добро пожаловать"); // <- error
	const catalog = new LocalizationCatalog(messages, "Unknown");
	catalog.report();
})();
```

## Good

```ts
// File: src/localization_catalog.ts
/** Responsibilities: _localized message lookup_. **/
export class LocalizationCatalog {
	private readonly _messages: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _localization data initialization_. **/
	public constructor(messages: ReadonlyMap<string, string>, fallback: string) {
		this._messages = messages;
		this._fallback = fallback;
	}

	/** Responsibilities: _message resolution_. **/
	public message(message_id: string): string {
		const message = this._messages.get(message_id);
		if (message === undefined) {
			return this._fallback;
		}
		return message;
	}

	/** Responsibilities: _contextual message composition_. **/
	public message_with_context(context_label: string, contextual_id: string): string {
		const message = this.message(contextual_id);
		return `${context_label}: ${message}`;
	}

	/** Responsibilities: _fallback normalization_. **/
	public normalized_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _message count_. **/
	public message_count(): number {
		let count = 0;
		for (const key of this._messages.keys()) {
			if (key.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _localization report output_. **/
	public report(): void {
		const welcome = this.message("welcome");
		const contextual = this.message_with_context("Status", "welcome");
		const fallback = this.normalized_fallback();
		const count = this.message_count();
		console.log(`${welcome} | ${contextual} | ${fallback} | ${count}`);
	}
}
// File: cli.ts
import { LocalizationCatalog } from "src/localization_catalog";

(function () {
	const messages = new Map<string, string>();
	messages.set("welcome", "Welcome");
	const catalog = new LocalizationCatalog(messages, "Unknown");
	catalog.report();
})();
```
