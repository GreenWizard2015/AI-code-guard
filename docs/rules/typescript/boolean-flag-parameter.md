# boolean-flag-parameter

Description: Reports a production TypeScript or Python callable with at least two explicitly
typed boolean parameters. A single boolean parameter is allowed. Test files are
not checked by this rule.

Replace independent positional flags with a named options or state object so
the call expresses each mode explicitly.

## Bad

```ts
function publish(article: Article, notify: boolean, dry_run: boolean): void {
	// ...
}

publish(article, true, false);
```


## Good

```ts
// File: src/publication_policy.ts
/** Responsibilities: _publication capability_. **/
export class PublicationPolicy {
	private readonly mode: string;

	/** Responsibilities: _publication mode initialization_. **/
	public constructor(mode: string) {
		this.mode = mode;
	}

	/** Responsibilities: _publication capability decision_. **/
	public publishable(): boolean {
		return this.mode === "notify";
	}

	/** Responsibilities: _delivery mode description_. **/
	public delivery_description(): string {
		const normalized_mode = this.mode.trim();
		return normalized_mode.toUpperCase();
	}

	/** Responsibilities: _delivery channel selection_. **/
	public delivery_channel(): string {
		if (this.mode === "notify") {
			return "email";
		}
		if (this.mode === "preview") {
			return "preview";
		}
		return "none";
	}
}
// File: cli.ts
import { PublicationPolicy } from "src/publication_policy";

(function () {
	const publication_policy = new PublicationPolicy("preview");
	const publishable = publication_policy.publishable();
	const delivery_mode = publication_policy.delivery_description();
	const channel = publication_policy.delivery_channel();
	console.log(`${publishable} ${delivery_mode} ${channel}`);
})();
```
