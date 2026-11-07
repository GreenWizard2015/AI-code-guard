# Interface And Protocol Fields

Description: See the examples below for the rule behavior.

### Purpose

Interfaces define behavior boundaries and must not declare fields, including `readonly`
fields. Put state in implementing classes and expose behavior through methods.

### Preferred

```ts
interface UserStore {
  get(id: string): string;
}

class InMemoryUserStore implements UserStore {
  private readonly cache = new Map<string, string>();

  public get(id: string): string {
    const value = this.cache.get(id);
    if (value === undefined) {
      return '';
    }
    return value;
  }
}
```


## Bad

```ts
// File: src/protocols.ts
export interface UserStoreContract {
	cache: Map<string, string>; // <- error
	readonly name: string; // <- error
	get(id: string): string;
}
// File: src/user_store.ts
import type { UserStoreContract } from "src/protocols";

export class UserStore implements UserStoreContract {
	public readonly cache: Map<string, string>;
	public readonly name: string;
	public constructor(name: string) {
		this.cache = new Map<string, string>();
		this.name = name;
		this.cache.set("u-1", "Ada");
	}
	public get(id: string): string {
		const value = this.cache.get(id);
		if (value === undefined) {
			return "missing";
		}
		return value;
	}
	public report(): void {
		console.log(`${this.name}: ${this.get("u-1")}`);
	}
}
// File: cli.ts
import { UserStore } from "src/user_store";
(function () {
	const store = new UserStore("directory");
	store.report();
})();
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _knowledge article behavior contract_. **/
export interface KnowledgeArticleContract {
	/** Responsibilities: _article heading formatting_. **/
	heading(): string;
	/** Responsibilities: _article content normalization_. **/
	normalized_content(): string;
	/** Responsibilities: _article length calculation_. **/
	content_length(): number;
}
// File: src/knowledge_article.ts
import type { KnowledgeArticleContract } from "src/protocols";


/** Responsibilities: _knowledge article management_. **/
export class KnowledgeArticle implements KnowledgeArticleContract {
	private readonly _title: string;
	private readonly _content: string;
	/** Responsibilities: _article initialization_. **/
	public constructor(title: string, content: string) {
		this._title = title;
		this._content = content;
	}
	/** Responsibilities: _article heading formatting_. **/
	public heading(): string {
		return this._title.trim().toUpperCase();
	}
	/** Responsibilities: _article content normalization_. **/
	public normalized_content(): string {
		return this._content.trim().replace(/\s+/gu, " ");
	}
	/** Responsibilities: _article length calculation_. **/
	public content_length(): number {
		const content = this._content.trim();
		let length = 0;
		for (const character of content) { length += 1; }
		return length;
	}
	/** Responsibilities: _article report output_. **/
	public report(): void {
		const content = this.normalized_content();
		const heading = this.heading();
		const length = this.content_length();
		const line = `${heading}: ${content} (${length} characters)`;
		console.log(line);
	}
}
// File: cli.ts
import { KnowledgeArticle } from "src/knowledge_article";
(function () {
	const article = new KnowledgeArticle("Release notes", "ready");
	article.report();
})();
```

