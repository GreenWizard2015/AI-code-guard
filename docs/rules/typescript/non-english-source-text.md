# `non-english-source-text`

Description: Production comments and string literals must use English. In test files, check comments only; test literals may use any language. Markdown and supported text-file prose is checked too. Non-Latin scripts, including Cyrillic and CJK ideographs, are detected; Latin accents are allowed.

## Bad

```ts
// File: cli.ts
const message = "Добро пожаловать"; // <- error
```

## Good

```ts
// File: src/localization_catalog.ts
/** Responsibilities: _localized message lookup_. **/
export class LocalizationCatalog {
	private readonly messages: ReadonlyMap<string, string>;
	private readonly fallback: string;

	/** Responsibilities: _localization data initialization_. **/
	public constructor(messages: ReadonlyMap<string, string>, fallback: string) {
		this.messages = messages;
		this.fallback = fallback;
	}

	/** Responsibilities: _message resolution_. **/
	public message(key: string): string {
		const message = this.messages.get(key);
		if (message === undefined) {
			return this.fallback;
		}
		return message;
	}

	/** Responsibilities: _contextual message composition_. **/
	public message_with_context(context: string, key: string): string {
		const message = this.message(key);
		return `${context}: ${message}`;
	}

	/** Responsibilities: _fallback normalization_. **/
	public normalized_fallback(): string {
		const normalized = this.fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _message count_. **/
	public message_count(): number {
		let count = 0;
		for (const key of this.messages.keys()) {
			if (key.length > 0) {
				count += 1;
			}
		}
		return count;
	}
}
// File: cli.ts
import { LocalizationCatalog } from "src/localization_catalog";

(function () {
	const messages = new Map<string, string>();
	messages.set("welcome", "Welcome");
	const catalog = new LocalizationCatalog(messages, "Unknown");
	const welcome = catalog.message("welcome");
	const contextual = catalog.message_with_context("Status", "welcome");
	const fallback = catalog.normalized_fallback();
	const count = catalog.message_count();
	console.log(`${welcome} ${contextual} ${fallback} ${count}`);
})();
```
