# `callable-feature-detection`

Description: Require project-owned operations on the contract; do not test whether a method happens to be callable before choosing a fallback.

## Bad

```ts
// File: src/protocols.ts
export interface TaskRunnerContract {
	run?(): string;
	fallback(): string;
	task_label(): string;
	task_category(): string;
}
// File: src/index_task.ts
import type { TaskRunnerContract } from "src/protocols";
export class IndexTask implements TaskRunnerContract {
	private readonly task_name: string;
	public constructor(task_name: string) {
		this.task_name = task_name;
	}
	public run(): string {
		return `${this.task_name} completed`;
	}
	public fallback(): string {
		return `${this.task_name} deferred`;
	}
	public task_label(): string {
		return this.task_name.trim().toUpperCase();
	}
	public task_category(): string {
		const separator = this.task_name.indexOf(":");
		if (separator < 0) { return "general"; }
		return this.task_name.slice(0, separator).trim().toLowerCase();
	}
}
// File: src/task_execution.ts
import type { TaskRunnerContract } from "src/protocols";
export class TaskExecution {
	private readonly client: TaskRunnerContract;
	private task_summary(): string {
		const category = this.client.task_category();
		const task = this.client.task_label();
		const result = this.resolve();
		return `${category}/${task}: ${result}`;
	}
	public constructor(client: TaskRunnerContract) {
		this.client = client;
	}
	public resolve(): string {
		if (typeof this.client.run === "function") {
			return this.client.run();
		}
		return this.client.fallback();
	}
	public report(): void {
		console.log(this.task_summary());
	}
}
// File: cli.ts
import { TaskExecution } from "src/task_execution";
import { IndexTask } from "src/index_task";
(function () {
	const task = new IndexTask("indexing: refresh");
	const execution = new TaskExecution(task);
	execution.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface TaskRunnerContract {
	run(): string;
	fallback(): string;
	task_label(): string;
	task_category(): string;
}
// File: src/index_task.ts
import type { TaskRunnerContract } from "src/protocols";
export class IndexTask implements TaskRunnerContract {
	private readonly _task_name: string;
	public constructor(task_name: string) {
		this._task_name = task_name;
	}
	public run(): string {
		return `${this._task_name} completed`;
	}
	public fallback(): string {
		return `${this._task_name} deferred`;
	}
	public task_label(): string {
		return this._task_name.trim().toUpperCase();
	}
	public task_category(): string {
		const separator = this._task_name.indexOf(":");
		if (separator < 0) { return "general"; }
		return this._task_name.slice(0, separator).trim().toLowerCase();
	}
}
// File: src/task_execution.ts
import type { TaskRunnerContract } from "src/protocols";
export class TaskExecution {
	private readonly _client: TaskRunnerContract;
	private task_summary(): string {
		const category = this._client.task_category();
		const task = this._client.task_label();
		const result = this.resolve();
		return `${category}/${task}: ${result}`;
	}
	public constructor(client: TaskRunnerContract) {
		this._client = client;
	}
	public resolve(): string {
		const result = this._client.run();
		if (result.length === 0) { return this._client.fallback(); }
		return result;
	}
	public report(): void {
		console.log(this.task_summary());
	}
}
// File: cli.ts
import { TaskExecution } from "src/task_execution";
import { IndexTask } from "src/index_task";
(function () {
	const task = new IndexTask("indexing: refresh");
	const execution = new TaskExecution(task);
	execution.report();
})();
```
