# `multiple-result-shapes`

Description: Business logic should not know every upstream response representation.

```ts
if (response.content !== undefined) {
  return response.content;
}
if (response.result !== undefined) {
  if (response.result.content !== undefined) {
    return response.result.content;
  }
}
return response;
```

Python response branching is covered too:


Fix: Normalize the upstream response once at the transport boundary.

## Bad

```ts
// File: src/protocols.ts
export interface ToolResponseContract {
	content_text(): string;
	summary(): string;
	content_size(): number;
}

// File: src/tool_response.ts
#!/usr/bin/env node
import { ToolResponseContract } from "src/protocols";
export class ToolResponse implements ToolResponseContract {
	private readonly response_data: Record<string, string>;
	public constructor(response_data: Record<string, string>) { this.response_data = response_data; }
	public content_text(): string {
		const content = this.response_data["structuredContent"]; // <- error
		const normalized = content.trim();
		return normalized.toUpperCase();
	}
	public summary(): string { const content = this.content_text(); const label = content.length === 0 ? "empty" : "content"; return `${label}: ${content}`; }
	public content_size(): number { let size = 0; for (const character of this.content_text()) { if (character.trim().length > 0) { size += 1; } } return size; }
}
// File: cli.ts
#!/usr/bin/env node
import { ToolResponse } from "src/tool-response";
(function () { const response = new ToolResponse({ structuredContent: " ready " }); console.log(response.content_text(), response.summary(), response.content_size()); })();
```


## Good

```ts
// File: src/protocols.ts
export interface ToolResponseContract {
	content_text(): string;
	summary(): string;
	content_size(): number;
}

// File: src/tool_response.ts
#!/usr/bin/env node
import { ToolResponseContract } from "src/protocols";
/** Responsibilities: _tool response content access_. **/
export class ToolResponse implements ToolResponseContract {
	private readonly content: string;
	/** Responsibilities: _response initialization_. **/
	public constructor(content: string) { this.content = content; }
	/** Responsibilities: _response content normalization_. **/
	public content_text(): string { const normalized = this.content.trim(); if (normalized.length === 0) { return "empty"; } return normalized.toUpperCase(); }
	/** Responsibilities: _response summary composition_. **/
	public summary(): string { const content = this.content_text(); const label = content.length === 0 ? "empty" : "content"; return `${label}: ${content}`; }
	/** Responsibilities: _response content size calculation_. **/
	public content_size(): number { let size = 0; for (const character of this.content_text()) { if (character.trim().length > 0) { size += 1; } } return size; }
}
// File: cli.ts
#!/usr/bin/env node
import { ToolResponse } from "src/tool-response";
(function () { const response = new ToolResponse("ready"); console.log(response.content_text(), response.summary(), response.content_size()); })();
```

