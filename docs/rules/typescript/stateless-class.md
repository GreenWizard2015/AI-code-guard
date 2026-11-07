# `stateless-class`

Description: A class with no instance state is often a namespace in disguise. Implementing a contract or merely storing readonly primitive values and lookup collections does not make it stateful. A constructor-retained dependency counts when the class uses it; a scalar value counts when methods use it to enforce a domain decision or invariant. Mutable fields, owned readonly object collaborators, and readonly collections that methods actually mutate also count. Static fields do not represent instance state.

## Bad

```ts
// File: src/reader.ts
export class Reader {
	public read(): void {
		console.log("ok");
	}
}
// File: cli.ts
import { Reader } from "src/reader";

(() => {
	const reader = new Reader();
	reader.read();
})();
```

**Fix:** First search the whole repository for construction, type references, and member calls. Then inspect callers for options, dependencies, and lifecycle data that belong together as immutable class state. Keep the class when that state defines a real adapter or protocol boundary; otherwise use module functions or composition. Do not add fields, wrappers, or methods only to silence lint.

## Good

```ts
// File: src/reading_session.ts
export class ReadingSession {
	private readonly _source_name: string;
	private readonly _pending_lines: string[];
	private readonly _consumed_lines: string[];

	public constructor(source_name: string, lines: string[]) {
		this._source_name = source_name;
		this._pending_lines = [...lines];
		this._consumed_lines = [];
	}

	public pending_count(): number {
		return this._pending_lines.length;
	}

	public take_next_line(): string {
		const line = this._pending_lines.shift();
		if (line === undefined) { throw new Error("No pending lines"); }
		this._consumed_lines.push(line);
		return line;
	}

	public consume_all_lines(): string[] {
		const consumed_lines: string[] = [];
		while (this.pending_count() > 0) {
			consumed_lines.push(this.take_next_line());
		}
		return consumed_lines;
	}

	public report(): void {
		console.log(`${this._source_name} (${this._consumed_lines.length}): ${this._consumed_lines.join(", ")}`);
	}
}
// File: src/cli.ts
import { ReadingSession } from "src/reading_session";

(() => {
	const session = new ReadingSession("daily-log", ["ok"]);
	session.consume_all_lines();
	session.report();
})();
```
