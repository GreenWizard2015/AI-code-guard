# `facade-file-content`

Description: Facade files such as `index.ts` and `__init__.py` may contain imports and re-exports only.

## Bad

```ts
// File: src/index.ts
export class StatusCatalog {
	private readonly statuses: readonly string[];
	public constructor(statuses: readonly string[]) {
		this.statuses = statuses;
	}
	public status_count(): number {
		return this.statuses.length;
	}
	public status_label(): string {
		return this.statuses.join(", ");
	}
	public report(): void {
		const label = this.status_label();
		const count = this.status_count();
		console.log(`${label} (${count})`);
	}
}
// File: cli.ts
import "src/index";
import { StatusCatalog } from "src/index";
(function () {
	const catalog = new StatusCatalog(["ready", "queued"]);
	catalog.report();
})();
```


## Good

```ts
// File: src/index.ts
import "src/status_catalog";
// File: src/status_catalog.ts
export class StatusCatalog {
	private readonly _statuses: readonly string[];
	public constructor(statuses: readonly string[]) {
		this._statuses = statuses;
	}
	public status_count(): number {
		return this._statuses.length;
	}
	public status_label(): string {
		return this._statuses.join(", ");
	}
	public normalized_statuses(): string[] {
		const normalized_statuses: string[] = [];
		for (const status of this._statuses) {
			const normalized_status = status.trim().toUpperCase();
			if (normalized_status.length > 0) {
				normalized_statuses.push(normalized_status);
			}
		}
		return normalized_statuses;
	}
	public first_status(): string {
		const normalized_statuses = this.normalized_statuses();
		if (normalized_statuses.length === 0) {
			return "empty";
		}
		return normalized_statuses[0];
	}
	public summary(): string {
		const label = this.status_label();
		const count = this.status_count();
		const first = this.first_status();
		return `${label} (${count}; first=${first})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import "src/index";
import { StatusCatalog } from "src/status_catalog";
(function () {
	const catalog = new StatusCatalog(["ready", "queued"]);
	catalog.report();
})();
```

