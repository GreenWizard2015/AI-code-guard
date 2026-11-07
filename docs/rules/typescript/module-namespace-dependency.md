# `module-namespace-dependency`

Description: Do not pass an imported module namespace into a class constructor. Keep platform modules inside their adapter and pass a project-owned contract between collaborators.

## Bad

```ts
// File: src/platform_files.ts
export class SourceFileStore {
	private readonly files: ReadonlyMap<string, string>;
	public constructor(files: ReadonlyMap<string, string>) {
		this.files = files;
	}
	public read_source(source_path: string): string {
		const content = this.files.get(source_path);
		if (content === undefined) {
			return "";
		}
		return content;
	}
	public source_available(availability_path: string): boolean {
		return this.files.has(availability_path);
	}
	public source_lines(line_source_path: string): string[] {
		return this.read_source(line_source_path).split("\\n");
	}
}
// File: src/io/source_text.ts
import * as platform_files from "src/platform_files";

export class SourceText {
	private readonly platform_module: typeof platform_files;
	private readonly source_path: string;
	public constructor(platform_module: typeof platform_files, source_path: string) {
		this.platform_module = platform_module;
		this.source_path = source_path;
	}
	public source_text(): string {
		const store = new this.platform_module.SourceFileStore(new Map([[this.source_path, "ready"]]));
		return store.read_source(this.source_path);
	}
	public report(): void {
		console.log(this.source_text());
	}
}
// File: cli.ts
import * as platform_files from "src/platform_files";
import { SourceText } from "src/io/source_text";
(function () {
	const source = new SourceText(platform_files, "input.txt");
	source.report();
})();
```

## Good

Pass a project contract to the consumer; keep the imported module inside the adapter.

```ts
// File: src/protocols.ts
export type SourceSnapshot = {
	content: string;
	exists: boolean;
};
export interface SourceFileStoreContract {
	snapshot(path: string): SourceSnapshot;
	source_names(): string[];
}
// File: src/source_file_store.ts
import type { SourceFileStoreContract, SourceSnapshot } from "src/protocols";
export class SourceFileStore implements SourceFileStoreContract {
	private readonly _files: ReadonlyMap<string, string>;
	public constructor(files: ReadonlyMap<string, string>) {
		this._files = files;
	}
	public snapshot(path: string): SourceSnapshot {
		const content = this._files.get(path);
		if (content === undefined) {
			return { content: "", exists: false };
		}
		return { content, exists: true };
	}
	public source_names(): string[] {
		const names: string[] = [];
		for (const source_name of this._files.keys()) {
			if (source_name.trim().length > 0) {
				names.push(source_name);
			}
		}
		return names.sort();
	}
}
// File: src/io/source_text.ts
import type { SourceFileStoreContract } from "src/protocols";
export class SourceText {
	private readonly _source_access: SourceFileStoreContract;
	private readonly _source_path: string;
	public constructor(source_access: SourceFileStoreContract, source_path: string) {
		this._source_access = source_access;
		this._source_path = source_path;
	}
	public source_text(): string {
		const snapshot = this._source_access.snapshot(this._source_path);
		return snapshot.content.trim();
	}
	public status(): string {
		const available = this._source_access.snapshot(this._source_path).exists;
		if (!available) { return "missing"; }
		return "available";
	}
	public summary(): string {
		const text = this.source_text();
		const status = this.status();
		const source_names = this._source_access.source_names().join(", ");
		return `${status}: ${text} (${source_names})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { SourceFileStore } from "src/source_file_store";
import { SourceText } from "src/io/source_text";
import type { SourceFileStoreContract } from "src/protocols";
(function () {
	const source_path = "input.txt";
	const files = new Map([[source_path, " ready "]]);
	const source_access: SourceFileStoreContract = new SourceFileStore(files);
	const source = new SourceText(source_access, source_path);
	source.report();
})();
```
