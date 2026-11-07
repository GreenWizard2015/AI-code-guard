# `interface-shape`

Description: Use an interface for a behavior contract instead of putting method signatures in an ordinary type alias.

## Bad

```ts
// File: src/types.ts
export type DirectoryContract = {
	directory_name: string;
	list_entries(): string[];
	entry_count(): number;
};
// File: src/directory_reader.ts
import type { DirectoryContract } from "src/types";

export class DirectoryReader implements DirectoryContract {
	public readonly directory_name: string;
	public constructor(directory_name: string) {
		this.directory_name = directory_name;
	}
	public list_entries(): string[] {
		return ["manual.txt", "notes.txt"];
	}
	public entry_count(): number {
		return this.list_entries().length;
	}
	public report(): void {
		console.log(`${this.directory_name}: ${this.entry_count()} entries`);
	}
}
// File: cli.ts
import { DirectoryReader } from "src/directory_reader";
(function () {
	const directory = new DirectoryReader("documents");
	directory.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface DirectoryEntriesContract {
	list_entries(): string[];
	entry_count(): number;
}

export interface DirectorySummaryContract {
	directory_summary(entries: DirectoryEntriesContract): string;
}
// File: src/directory_catalog.ts
import type { DirectoryEntriesContract, DirectorySummaryContract } from "src/protocols";

export class DirectoryCatalog implements DirectoryEntriesContract, DirectorySummaryContract {
	private readonly _directory_name: string;
	public constructor(directory_name: string) {
		this._directory_name = directory_name;
	}
	public list_entries(): string[] {
		return ["manual.txt", "notes.txt"];
	}
	public entry_count(): number {
		return this.list_entries().length;
	}
	public directory_summary(entries: DirectoryEntriesContract): string {
		return `${this._directory_name}: ${entries.entry_count()} entries`;
	}
	public report(): void {
		const summary = this.directory_summary(this);
		console.log(summary);
	}
}
// File: cli.ts
import { DirectoryCatalog } from "src/directory_catalog";
(function () {
	const directory = new DirectoryCatalog("documents");
	directory.report();
})();
```
