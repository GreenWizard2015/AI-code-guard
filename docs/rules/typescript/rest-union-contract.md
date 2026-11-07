# `rest-union-contract`

Description: See the examples below for the rule behavior.

### Policy

Do not use any union anywhere in the type of a TypeScript rest parameter.

### Fix

Use one explicit options object or separate named operations:

```ts
type CollectOptions = {
    context?: LintProjectContext;
    entry_files?: readonly string[];
};

function collect(root: string, options: CollectOptions = {}): Violation[] {
    // The contract is explicit.
}
```

## Bad

```ts
// File: src/types.ts
export type ProjectContext = { root: string };
// File: src/collection_planner.ts
import type { ProjectContext } from "src/types";

/** Responsibilities: _source collection planning_. **/
export class CollectionPlanner {
	private readonly root: string;
	/** Responsibilities: _planner initialization_. **/
	public constructor(root: string) {
		this.root = root;
	}
	/** Responsibilities: _collection input counting_. **/
	public collect(...provided: (ProjectContext | readonly string[] | undefined)[]): number { // <- error
		return provided.length;
	}
	/** Responsibilities: _collection summary formatting_. **/
	public summary(): string {
		const input_count = this.collect({ root: this.root }, ["main.ts"], undefined);
		return `${this.root}: ${input_count} collection inputs`;
	}
	/** Responsibilities: _collection report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { CollectionPlanner } from "src/collection_planner";

(() => {
	const planner = new CollectionPlanner("src");
	planner.report();
})();
```

## Good

```ts
// File: src/types.ts
export type CollectOptions = { root: string; entry_files: readonly string[] };
// File: src/collection_planner.ts
import type { CollectOptions } from "src/types";

/** Responsibilities: _source collection planning_. **/
export class CollectionPlanner {
	private readonly _options: CollectOptions;
	/** Responsibilities: _planner initialization_. **/
	public constructor(options: CollectOptions) {
		this._options = options;
	}
	/** Responsibilities: _root label formatting_. **/
	public root_label(): string {
		return `Root ${this._options.root}`;
	}
	/** Responsibilities: _entry count reporting_. **/
	public entry_count(): number {
		return this._options.entry_files.length;
	}
	/** Responsibilities: _root path depth_. **/
	public root_depth(): number {
		const segments = this._options.root.split("/");
		let depth = 0;
		for (const segment of segments) {
			if (segment.length > 0) { depth += 1; }
		}
		return depth;
	}
	/** Responsibilities: _entry file listing_. **/
	public entry_listing(): string {
		return this._options.entry_files.join(", ");
	}
	/** Responsibilities: _collection summary formatting_. **/
	public summary(): string {
		return `${this.root_label()} (${this.root_depth()} levels): ${this.entry_count()} entry files [${this.entry_listing()}]`;
	}
	/** Responsibilities: _collection report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { CollectionPlanner } from "src/collection_planner";

(() => {
	const options = { root: "src", entry_files: ["main.ts"] };
	const planner = new CollectionPlanner(options);
	planner.report();
})();
```
