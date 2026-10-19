# single-class-file-name

Description: Keep a production file containing exactly one implementation class named `MyClass` in the sibling file `my_class.ts` or `my_class.py`. Convert the complete class name to snake_case for both TypeScript and Python. Kebab-case names such as `my-class.ts` are forbidden.

Test files and facade files (`index.ts`, `index.py`, and `__init__.py`) are not renamed by this rule.

## Bad

```ts
class RecordIdentifier {}
```


## Good

```ts
/** Responsibilities: _record identity_, _prefix normalization_. **/
export class RecordIdentifier {
	private readonly value_text: string;

	/** Responsibilities: _initial identity_. **/
	public constructor(value: string) {
		this.value_text = value.trim();
	}

	/** Responsibilities: _identity view_. **/
	public value(): string {
		return this.with_prefix("");
	}

	/** Responsibilities: _prefix comparison_. **/
	public matches_prefix(prefix: string): boolean {
		return this.value_text.startsWith(`${prefix}:`);
	}

	/** Responsibilities: _prefix identity_. **/
	public with_prefix(prefix: string): string {
		if (prefix.length === 0) {
			return this.value_text;
		}
		if (this.matches_prefix(prefix)) {
			return this.value_text;
		}
		const prefixed = new RecordIdentifier(`${prefix}:${this.value_text}`);
		return prefixed.value();
	}
}
```
