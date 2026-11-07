# empty-error-handler

Description: Reports an empty TypeScript `catch` block or a Python `except` block containing
only `pass` or a standalone string. Handle, rethrow, or explicitly transform
the error instead. A handler with real recovery or reporting code is not
reported.

## Bad

```ts
// File: src/configuration.ts
/** Responsibilities: _configuration decoding and fallback_. **/
export class Configuration {
	private readonly _parameters: ReadonlyMap<string, string>;
	private readonly _parameter_key: string;
	private readonly _fallback_value: string;
	/** Responsibilities: _configuration source retention_. **/
	public constructor(parameters: ReadonlyMap<string, string>, parameter_key: string, fallback_value: string) {
		this._parameters = parameters;
		this._parameter_key = parameter_key;
		this._fallback_value = fallback_value;
	}
	/** Responsibilities: _configuration value lookup_. **/
	public encoded_value(): string {
		return this._parameters.get(this._parameter_key) ?? "";
	}
	/** Responsibilities: _configuration value presence_. **/
	public value_present(): boolean {
		return this.encoded_value().length > 0;
	}
	/** Responsibilities: _configuration text resolution_. **/
	public text(): string {
		if (!this.value_present()) {
			return this._fallback_value;
		}
		try {
			return decodeURIComponent(this.encoded_value());
		} catch {}
		return this._fallback_value;
	}
	/** Responsibilities: _configuration text normalization_. **/
	public normalized_text(): string {
		return this.text().trim();
	}
	public report(): void {
		console.log(this.value_present(), this.normalized_text());
	}
}
// File: cli.ts
import { Configuration } from "src/configuration";
(function () {
	const parameters = new Map<string, string>();
	parameters.set("value", "%ZZ");
	const configuration = new Configuration(parameters, "value", "Using built-in defaults");
	configuration.report();
})();
```


## Good

```ts
// File: src/configuration.ts
/** Responsibilities: _configuration decoding and fallback_. **/
export class Configuration {
	private readonly _parameters: ReadonlyMap<string, string>;
	private readonly _parameter_key: string;
	private readonly _fallback_value: string;
	/** Responsibilities: _configuration source retention_. **/
	public constructor(parameters: ReadonlyMap<string, string>, parameter_key: string, fallback_value: string) {
		this._parameters = parameters;
		this._parameter_key = parameter_key;
		this._fallback_value = fallback_value;
	}
	/** Responsibilities: _configuration value lookup_. **/
	public encoded_value(): string {
		return this._parameters.get(this._parameter_key) ?? "";
	}
	/** Responsibilities: _configuration value presence_. **/
	public value_present(): boolean {
		return this.encoded_value().length > 0;
	}
	/** Responsibilities: _configuration text resolution_. **/
	public text(): string {
		if (!this.value_present()) {
			return this._fallback_value;
		}
		const encoded_value = this.encoded_value();
		const has_malformed_escape = /%(?![0-9A-Fa-f]{2})/u.test(encoded_value);
		if (has_malformed_escape) {
			return this._fallback_value;
		}
		return decodeURIComponent(encoded_value);
	}
	/** Responsibilities: _configuration text normalization_. **/
	public normalized_text(): string {
		return this.text().trim();
	}
	public report(): void {
		console.log(this.value_present(), this.normalized_text());
	}
}
// File: cli.ts
import { Configuration } from "src/configuration";
(function () {
	const parameters = new Map<string, string>();
	parameters.set("value", "%20ready%20");
	const configuration = new Configuration(parameters, "value", "Using built-in defaults");
	configuration.report();
})();
```

