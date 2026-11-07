# boolean-flag-parameter

Description: Reports a production TypeScript or Python callable with at least two explicitly
typed boolean parameters. A single boolean parameter is allowed. Test files are
not checked by this rule.

Replace independent positional flags with a named options or state object so
the call expresses each mode explicitly.

## Bad

```ts
// File: src/article_publisher.ts
/** Responsibilities: _article publication_. **/
export class ArticlePublisher { // <- error
	private readonly channel: string;
	/** Responsibilities: _publisher initialization_. **/
	public constructor(channel: string) {
		this.channel = channel;
	}
	/** Responsibilities: _publication decision_. **/
	public publish(article: string, notify: boolean, dry_run: boolean): string {
		if (dry_run) { return `Preview: ${article.trim()}`; }
		if (notify) { return `${this.channel}: ${article.trim()}`; }
		return `Stored: ${article.trim()}`;
	}
	/** Responsibilities: _publication summary formatting_. **/
	public summary(): string {
		return this.publish("Release notes", true, false);
	}
	/** Responsibilities: _publication report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ArticlePublisher } from "src/article_publisher";

(() => {
	const publisher = new ArticlePublisher("Notification");
	publisher.report();
})();
```


## Good

```ts
// File: src/constants.ts
export const ARTICLE_TEXT = "Release notes";
export const PREVIEW_PREFIX = "Preview: ";
export const NOTIFICATION_PREFIX = "Notification: ";
export const STORAGE_PREFIX = "Stored: ";
export const PREVIEW_MODE = "Preview mode";
export const NOTIFICATION_MODE = "Notification mode";
export const STORAGE_MODE = "Storage mode";
// File: src/types.ts
export type PublicationOptions = { notify: boolean; dry_run: boolean };
// File: src/article_publisher.ts
import type { PublicationOptions } from "src/types";
import {
	ARTICLE_TEXT,
	NOTIFICATION_MODE,
	NOTIFICATION_PREFIX,
	PREVIEW_MODE,
	PREVIEW_PREFIX,
	STORAGE_MODE,
	STORAGE_PREFIX,
} from "src/constants";

/** Responsibilities: _article publication_. **/
export class ArticlePublisher {
	private readonly _options: PublicationOptions;
	/** Responsibilities: _publisher initialization_. **/
	public constructor(options: PublicationOptions) {
		this._options = options;
	}
	/** Responsibilities: _publication decision_. **/
	public publish(article: string): string {
		const normalized_article = article.trim();
		if (this._options.dry_run) { return `${PREVIEW_PREFIX}${normalized_article}`; }
		if (this._options.notify) { return `${NOTIFICATION_PREFIX}${normalized_article}`; }
		return `${STORAGE_PREFIX}${normalized_article}`;
	}
	/** Responsibilities: _delivery description_. **/
	public delivery_description(): string {
		if (this._options.dry_run) { return PREVIEW_MODE; }
		if (this._options.notify) { return NOTIFICATION_MODE; }
		return STORAGE_MODE;
	}
	/** Responsibilities: _publication report output_. **/
	public report(): void {
		console.log(`${this.publish(ARTICLE_TEXT)} | ${this.delivery_description()}`);
	}
}
// File: cli.ts
import { ArticlePublisher } from "src/article_publisher";

(() => {
	const publisher = new ArticlePublisher({ notify: true, dry_run: false });
	publisher.report();
})();
```
