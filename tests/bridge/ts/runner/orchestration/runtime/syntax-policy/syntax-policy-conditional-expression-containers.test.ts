import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional execution expression container policy", () => {
	test("rejects logical expressions under await", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"await-conditional.ts":
				"async function run(): Promise<string> { const candidate = await (ready && load()); return candidate; }",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions returned from a function", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"return-conditional.ts":
				"function load_value(): boolean { return true; }\nfunction use_value(ready: boolean): boolean { return ready && load_value(); }",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions under yield", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"yield-conditional.ts":
				"function* run(): Generator<string, void, unknown> { const candidate = yield (ready && load()); return; }",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions passed to constructors", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"new-conditional.ts": "const candidate = new String(ready && load());",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in spread arguments", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"spread-argument-conditional.ts": "const candidate = consume(...[ready && load()]);",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in property access", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"property-conditional.ts": "const candidate = (ready && load())?.count;",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in arrow IIFEs", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"arrow-conditional.ts": "const candidate = (() => ready && load())();",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in function IIFEs", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"function-conditional.ts": "const candidate = (function () { return ready && load(); })();",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects standalone logical calls", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"standalone-conditional.ts": [
				"declare function load(): void;",
				"declare function recover(): void;",
				"ready && load();",
				"ready || recover();",
				"ready ?? load();",
			].join("\n"),
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(3);
	});

	test("rejects logical expressions in destructured parameter defaults", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"destructured-parameter-conditional.ts": [
				"declare function load(): string;",
				"export function selected(ready: boolean, { value = ready && load() }: { value?: string | false } = {}): string | false {",
				"\treturn value;",
				"}",
			].join("\n"),
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});
});
