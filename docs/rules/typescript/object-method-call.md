# `object-method-call`

Description: Indirect `.call` invocation obscures the receiver and contract.

```ts
Object.prototype.hasOwnProperty.call(value, key)
```


Fix: Use a typed helper or a direct, contract-specific operation.

## Bad

```ts
// File: src/preference_book.ts
/** Responsibilities: _preference lookup_. **/
export class PreferenceBook { // <- error
	private readonly settings: { theme: string; locale: string };
	/** Responsibilities: _preference initialization_. **/
	public constructor(theme: string, locale: string) {
		this.settings = { theme, locale };
	}
	/** Responsibilities: _preference presence lookup_. **/
	public contains_setting(key: "theme" | "locale"): boolean {
		return Object.prototype.hasOwnProperty.call(this.settings, key); // <- error
	}
	/** Responsibilities: _preference summary formatting_. **/
	public summary(): string {
		return `Theme present: ${this.contains_setting("theme")}`;
	}
	/** Responsibilities: _preference report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { PreferenceBook } from "src/preference_book";

(() => {
	const preferences = new PreferenceBook("dark", "en");
	preferences.report();
})();
```

## Good

```ts
// File: src/preference_book.ts
/** Responsibilities: _preference lookup_. **/
export class PreferenceBook {
	private readonly _theme: string;
	private readonly _locale: string;
	private readonly _accessed_settings: Set<string>;
	/** Responsibilities: _preference initialization_. **/
	public constructor() {
		this._theme = "dark";
		this._locale = "en";
		this._accessed_settings = new Set<string>();
	}
	/** Responsibilities: _preference presence lookup_. **/
	public contains_setting(key: string): boolean {
		const normalized_key = key.trim().toLowerCase();
		this._accessed_settings.add(normalized_key);
		if (normalized_key === "theme") {
			return this._theme.length > 0;
		}
		if (normalized_key === "locale") {
			return this._locale.length > 0;
		}
		return false;
	}
	/** Responsibilities: _preference label formatting_. **/
	public setting_label(key: string): string {
		const normalized_key = key.trim().toLowerCase();
		if (normalized_key === "theme") {
			return `theme: ${this._theme}`;
		}
		if (normalized_key === "locale") {
			return `locale: ${this._locale}`;
		}
		return "unknown preference";
	}
	/** Responsibilities: _preference summary formatting_. **/
	public summary(): string {
		const theme_label = this.setting_label("theme");
		const locale_label = this.setting_label("locale");
		const setting_count = Number(this.contains_setting("theme")) + Number(this.contains_setting("locale"));
		return `${theme_label} | ${locale_label} | ${setting_count} settings checked ${this._accessed_settings.size} times`;
	}
	/** Responsibilities: _preference report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { PreferenceBook } from "src/preference_book";

(() => {
	const preferences = new PreferenceBook();
	preferences.report();
})();
```
