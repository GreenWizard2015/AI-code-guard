# `production-test-import`

Description: Production code cannot import test modules; tests may import production code.
Move shared behavior into production modules.

## Bad

```ts
// File: src/application/application.ts
import { TestSupport } from "tests/support"; // <- error
export class Application {
	private readonly prefix: string;
	private readonly support: TestSupport;
	public constructor(prefix: string) {
		this.prefix = prefix;
		this.support = new TestSupport(" Ready ");
	}
	public status_message(): string {
		return this.support.format(this.prefix);
	}
	public status_code(): number {
		return this.support.ready() ? 200 : 503;
	}
	public summary(): string {
		return `${this.status_message()} (${this.status_code()})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: tests/support.ts
export class TestSupport {
	private readonly message: string;
	public constructor(message: string) {
		this.message = message;
	}
	public normalized(): string {
		return this.message.trim().toLowerCase();
	}
	public format(prefix: string): string {
		const normalized_prefix = prefix.trim();
		return `${normalized_prefix}: ${this.normalized()}`;
	}
	public ready(): boolean {
		return this.normalized().length > 0;
	}
}
// File: tests/application/application.test.ts
import { Application } from "src/application/application";
describe("Application", () => {
	test("formats a status message", () => {
		const application = new Application("App");
		expect(application.status_message()).toBe("App: ready");
	});
	test("reports readiness", () => {
		const application = new Application("App");
		expect(application.status_code()).toBe(200);
	});
});
// File: cli.ts
import { Application } from "src/application/application";
(function () {
	const application = new Application("App");
	application.report();
})();
```

## Good

```ts
// File: src/application/application.ts
import { MessageSupport } from "src/application/message_support";
export class Application {
	private readonly _prefix: string;
	private readonly _support: MessageSupport;
	public constructor(prefix: string) {
		this._prefix = prefix;
		this._support = new MessageSupport(" Ready ");
	}
	public status_message(): string {
		return this._support.format(this._prefix);
	}
	public status_code(): number {
		return this._support.ready() ? 200 : 503;
	}
	public summary(): string {
		return `${this.status_message()} (${this.status_code()})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: src/application/message_support.ts
export class MessageSupport {
	private readonly _normalized_cache: Map<string, string>;
	private readonly _message: string;
	public constructor(message: string) {
		this._message = message;

		this._normalized_cache = new Map();}
	public normalized(): string {
		const cached = this._normalized_cache.get(this._message);
		if (cached !== undefined) { return cached; }
		const normalized = this._message.trim().toLowerCase();
		this._normalized_cache.set(this._message, normalized);
		return normalized;
	}
	public format(prefix: string): string {
		const normalized_prefix = prefix.trim();
		return `${normalized_prefix}: ${this.normalized()}`;
	}
	public ready(): boolean {
		return this.character_count() > 0;
	}
	public character_count(): number {
		let count = 0;
		for (const character of this.normalized()) {
			if (character.length > 0) { count += 1; }
		}
		return count;
	}
}
// File: tests/application/application.test.ts
import { Application } from "src/application/application";
describe("Application", () => {
	test("formats a status message", () => {
		const application = new Application("App");
		expect(application.status_message()).toBe("App: ready");
	});
	test("reports readiness", () => {
		const application = new Application("App");
		expect(application.status_code()).toBe(200);
	});
});
// File: cli.ts
import { Application } from "src/application/application";
(function () {
	const application = new Application("App");
	application.report();
})();
```
