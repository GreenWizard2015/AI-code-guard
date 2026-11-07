# `namespace-file`

Description: A TypeScript file containing a namespace must contain exactly one namespace declaration. Outside that namespace, only static imports are allowed.

Keep classes, functions, values, and nested ownership inside the namespace so the file has one explicit boundary. The normal TypeScript rules still traverse and validate every declaration inside the namespace.

## Bad

```ts
// File: src/status_board.ts
export namespace StatusModel {
	export class StatusBoard {
		private readonly statuses: readonly string[];
		public constructor(statuses: readonly string[]) {
			this.statuses = statuses;
		}
		public status_count(): number {
			return this.statuses.length;
		}
		public status_label(): string {
			return `Statuses: ${this.statuses.join(", ")}`;
		}
		public report(fallback_label: string): void {
			const label = this.status_label();
			console.log(`${label || fallback_label} (${this.status_count()})`);
		}
	}
}
export const fallback_status_label = "No statuses"; // <- error
// File: cli.ts
import { StatusModel, fallback_status_label } from "src/status_board";
(function () {
	const board = new StatusModel.StatusBoard(["ready", "queued"]);
	board.report(fallback_status_label);
})();
```

## Good

```ts
// File: src/status_board.ts
export namespace StatusModel {
	export class StatusBoard {
		private readonly _statuses: readonly string[];
		private readonly _fallback_label: string;
		public constructor(statuses: readonly string[], fallback_label: string) {
			this._statuses = statuses;
			this._fallback_label = fallback_label;
		}
		public normalized_statuses(): readonly string[] {
			const normalized: string[] = [];
			for (const status of this._statuses) {
				normalized.push(status.trim().toUpperCase());
			}
			return normalized;
		}
		public status_count(): number {
			return this.normalized_statuses().length;
		}
		public ready_count(): number {
			let count = 0;
			for (const status of this.normalized_statuses()) {
				if (status === "READY") { count += 1; }
			}
			return count;
		}
		public status_label(): string {
			const statuses = this.normalized_statuses();
			if (statuses.length === 0) { return this._fallback_label; }
			return statuses.join(", ");
		}
		public summary(): string {
			const label = this.status_label();
			const total = this.status_count();
			const ready = this.ready_count();
			return `${label} (${ready}/${total} ready)`;
		}
		public report(): void {
			const summary = this.summary();
			console.log(summary);
		}
	}
}
// File: cli.ts
import { StatusModel } from "src/status_board";
(function () {
	const board = new StatusModel.StatusBoard(["ready", "queued"], "No statuses");
	board.report();
})();
```
