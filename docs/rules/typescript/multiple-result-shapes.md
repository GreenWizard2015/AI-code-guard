# `multiple-result-shapes`

Description: Business logic should not know every upstream response representation.

Python response branching is covered too.

Fix: Normalize the upstream response once at the transport boundary.

## Bad

```ts
// File: src/tool_response.ts
export class ToolResponse {
	private readonly structuredContent: string;
	private readonly unwrap_tool_result: string;

	private parse_upstream_response(): string {
		if (this.structuredContent.length > 0) {
			return this.structuredContent;
		}
		return this.unwrap_tool_result;
	}
	public constructor() {
		this.structuredContent = "ready";
		this.unwrap_tool_result = "fallback";
	}
	public content_text(): string {
		return this.parse_upstream_response();
	}
	public content_size(): number {
		const content = this.content_text();
		return content.length;
	}
	public summary(): string {
		return `Response (${this.content_size()}): ${this.content_text()}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ToolResponse } from "src/tool_response";
(function () {
	const response = new ToolResponse();
	response.report();
})();
```

## Good

```ts
// File: src/tool_response.ts
/** Responsibilities: _normalized response content access_. **/
export class ToolResponse {
	private readonly _content: string;
	public constructor(content: string) {
		this._content = content;
	}
	public content_text(): string {
		if (this._content.trim().length === 0) {
			return "";
		}
		const words = this._content.trim().split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			const normalized_word = word.trim().toUpperCase();
			if (normalized_word.length > 0) {
				normalized_words.push(normalized_word);
			}
		}
		return normalized_words.join(" ");
	}
	public summary(): string {
		const details = [
			"Normalized response",
			this.content_text(),
			`${this.content_size()} characters`,
		];
		return details.join(" | ");
	}
	public content_size(): number {
		let visible_count = 0;
		for (const character of this.content_text()) {
			if (character.trim().length > 0) {
				visible_count += 1;
			}
		}
		return visible_count;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ToolResponse } from "src/tool_response";
(function () {
	const response = new ToolResponse("ready");
	response.report();
})();
```
