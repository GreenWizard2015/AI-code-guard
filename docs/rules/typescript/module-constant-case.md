# `module-constant-case`

Description: Every TypeScript `const` declared at module level, including `export const`, must use
`UPPER_SNAKE_CASE`. Local constants are not covered by this rule.

## Bad

```ts
// File: src/constants.ts
export const label = "ready"; // <- error

// File: src/label_renderer.ts
export class LabelRenderer {
	private readonly label: string;

	public constructor(label: string) {
		this.label = label;
	}

	public normalized_label(): string {
		return this.label.trim().toLowerCase();
	}

	public displayed_label(): string {
		return this.normalized_label().toUpperCase();
	}

	public formatted_label(): string {
		return `[${this.displayed_label()}]`;
	}

	public report(): void {
		console.log(this.formatted_label());
	}
}
// File: cli.ts
import { label } from "src/constants";
import { LabelRenderer } from "src/label_renderer";

(() => {
	const renderer = new LabelRenderer(label);
	renderer.report();
})();
```

## Good

```ts
// File: src/constants.ts
export const LABEL = "ready";

// File: src/label_renderer.ts
export class LabelRenderer {
	private readonly _label: string;

	public constructor(label: string) {
		this._label = label;
	}

	public normalized_label(): string {
		if (this._label.trim().length === 0) {
			return "";
		}
		return this._label.trim().toLowerCase();
	}

	public displayed_label(): string {
		return this.normalized_label().toUpperCase();
	}

	public formatted_label(): string {
		return `[${this.displayed_label()}]`;
	}

	public prefixed_label(prefix: string): string {
		const normalized_prefix = prefix.trim().toUpperCase();
		const formatted = this.formatted_label();
		return `${normalized_prefix}: ${formatted}`;
	}

	public report(): void {
		console.log(this.prefixed_label("Status"));
	}
}
// File: cli.ts
import { LABEL } from "src/constants";
import { LabelRenderer } from "src/label_renderer";

(() => {
	const renderer = new LabelRenderer(LABEL);
	renderer.report();
})();
```
