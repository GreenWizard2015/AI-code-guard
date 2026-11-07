# `module-placement`

Description: Reports production modules nested below the common directory of their importers. Applies to classes, interfaces, protocols, types, constants, variables, functions, and mixed exports.

The diagnostic lists every top-level declaration with a destination: sibling `constants.ts`, `types.ts`, or `protocols.ts`; free functions go in the project-root `functions.ts`; other declarations go to the common importer boundary or a focused subdirectory. Move related exports with their module. Never suggest a path above the project root or inside a Git-ignored directory.

A focused directory may sit one or two levels below the common boundary when it contains at least three source files and is distinct from every caller directory. Isolated deep files move to the common boundary.

**Example:** `a/b/c/parser.ts` imported by `a/c/service.ts` and `a/view.ts` can move to `a/parser.ts` or `a/parser/parser.ts`.

Fix: inspect all importers, move the module and related declarations to the suggested ownership boundary, then update imports. Do not move files only to silence the diagnostic or create a generic shared folder.

## Bad

```ts
// File: src/a/b/c/constants.ts
export const MAX_ATTEMPTS = 3; // <- error
// File: src/a/attempt_reporter.ts
export class AttemptReporter {
	private readonly prefix: string;

	public constructor(prefix: string) {
		this.prefix = prefix;
	}

	public format_max_attempts(max_attempts: number): string {
		return `${this.prefix}: ${max_attempts}`;
	}

	public report_max_attempts(max_attempts: number): void {
		console.log(this.format_max_attempts(max_attempts));
	}
}
// File: src/a/cli.ts
import { MAX_ATTEMPTS } from "src/a/b/c/constants";
import { AttemptReporter } from "src/a/attempt_reporter";

(function run(): void {
	const reporter = new AttemptReporter("primary maximum");
	reporter.report_max_attempts(MAX_ATTEMPTS);
})();
// File: src/a/b/cli.ts
import { MAX_ATTEMPTS } from "src/a/b/c/constants";
import { AttemptReporter } from "src/a/attempt_reporter";

(function run(): void {
	const reporter = new AttemptReporter("secondary maximum");
	reporter.report_max_attempts(MAX_ATTEMPTS);
})();
```


## Good

```ts
// File: src/a/constants.ts
export const MAX_ATTEMPTS = 3;
// File: src/a/types.ts
export type AttemptPolicy = {
	max_attempts: number;
	warning_threshold: number;
};
// File: src/a/attempt_reporter.ts
import type { AttemptPolicy } from "src/a/types";
export class AttemptReporter {
	private readonly _prefix: string;
	private readonly _warning_threshold: number;
	private readonly _max_attempts_value: number;

	public constructor(prefix: string, policy: AttemptPolicy) {
		this._prefix = prefix;
		this._max_attempts_value = policy.max_attempts;
		this._warning_threshold = policy.warning_threshold;
	}

	public format_max_attempts(): string {
		return `${this._prefix}: ${this._max_attempts_value}`;
	}
	public exceeds_warning_threshold(): boolean {
		return this._max_attempts_value > this._warning_threshold;
	}
	public threshold_status(): string {
		if (this._max_attempts_value > this._warning_threshold) {
			return "above warning threshold";
		}
		if (this._max_attempts_value === this._warning_threshold) {
			return "at warning threshold";
		}
		return "within warning threshold";
	}
	public warning_message(): string {
		if (!this.exceeds_warning_threshold()) {
			return "";
		}
		return `review ${this._max_attempts_value} attempts`;
	}

	public report_max_attempts(): void {
		const parts = [
			this.format_max_attempts(),
			this.threshold_status(),
		];
		const warning = this.warning_message();
		if (warning.length > 0) {
			parts.push(warning);
		}
		console.log(parts.join(" | "));
	}
}
// File: src/a/cli.ts
import { MAX_ATTEMPTS } from "src/a/constants";
import { AttemptReporter } from "src/a/attempt_reporter";

(function run(): void {
	const policy = { max_attempts: MAX_ATTEMPTS, warning_threshold: 2 };
	const reporter = new AttemptReporter("primary maximum", policy);
	reporter.report_max_attempts();
})();
// File: src/a/b/cli.ts
import { MAX_ATTEMPTS } from "src/a/constants";
import { AttemptReporter } from "src/a/attempt_reporter";

(function run(): void {
	const policy = { max_attempts: MAX_ATTEMPTS, warning_threshold: 2 };
	const reporter = new AttemptReporter("secondary maximum", policy);
	reporter.report_max_attempts();
})();
```

