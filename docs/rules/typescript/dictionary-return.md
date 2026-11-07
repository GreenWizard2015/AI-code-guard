# `dictionary-return`

Description: Use a class when a returned dictionary-shaped value owns behavior or lifecycle; retain a data type for plain data.

## Bad

```ts
// File: src/article_view.ts
export type ArticleView = {
	heading(): string;
	content(): string;
	word_count(): string;
};
/** Responsibilities: _article view state and presentation_. **/
export class ArticleRenderer {
	private readonly title: string;
	private readonly content: string;
	private readonly count: number;
	/** Responsibilities: _article initialization_. **/
	public constructor(title: string, content: string, count: number) {
		this.title = title;
		this.content = content;
		this.count = count;
	}
	public heading_value(): string {
		return this.title.trim().toUpperCase();
	}
	public content_value(): string {
		return this.content.trim().replace(/\s+/gu, " ");
	}
	public count_value(): string {
		return String(this.count);
	}
	public view(): ArticleView {
		const heading = this.heading_value();
		const content = this.content_value();
		const count = this.count_value();
		return { // <- error
			heading(): string { return heading; },
			content(): string { return content; },
			word_count(): string { return count; },
		};
	}
	public report(): void {
		const view = this.view();
		console.log(`${view.heading()} | ${view.content()} | ${view.word_count()} words`);
	}
}
// File: cli.ts
import { ArticleRenderer } from "src/article_view";
(function () {
	const view = new ArticleRenderer("Release notes", "Ready to publish", 3);
	view.report();
})();
```

## Good

```ts
// File: src/article_view.ts
/** Responsibilities: _article view state and presentation_. **/
export class ArticleView {
	private readonly _title: string;
	private readonly _sections: string[];
	/** Responsibilities: _view initialization_. **/
	public constructor(title: string, content: string) {
		this._title = title;
		this._sections = [content];
	}
	/** Responsibilities: _view heading formatting_. **/
	public heading_label(): string {
		const title_words = this._title.trim().split(/\s+/u);
		const formatted_words: string[] = [];
		for (const word of title_words) {
			const initial = word.slice(0, 1).toUpperCase();
			const remainder = word.slice(1).toLowerCase();
			formatted_words.push(`${initial}${remainder}`);
		}
		return formatted_words.join(" ");
	}
	/** Responsibilities: _article section updates_. **/
	public append_section(section: string): void {
		this._sections.push(section);
	}
	/** Responsibilities: _view word counting_. **/
	public word_count(): number {
		const article_content = this._sections.join(" ");
		const words = article_content.trim().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) { count += 1; }
		}
		return count;
	}
	/** Responsibilities: _view summary composition_. **/
	public summary(): string {
		const heading = this.heading_label();
		const article_content = this._sections.join(" ");
		const content_words = article_content.trim().split(/\s+/u);
		const content = content_words.join(" ");
		const count = this.word_count();
		return `${heading}: ${content} (${count} words)`;
	}
	/** Responsibilities: _view report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ArticleView } from "src/article_view";
(function () {
	const view = new ArticleView("Release notes", "Ready to publish");
	view.append_section("Available today");
	view.report();
})();
```
