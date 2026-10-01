import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional execution container policy", () => {
	test("rejects logical expressions in array destructuring", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"array-conditional.ts": "const [candidate] = [ready && load()];",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in object destructuring", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"object-conditional.ts": "const { candidate } = { candidate: ready && load() };",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in nested value containers", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"nested-conditional.ts": "const { candidate } = { candidate: [ready && load()] };",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects parenthesized logical expressions in containers", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"parenthesized-conditional.ts": "const [candidate] = [(ready && load())];",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in object spreads", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"spread-conditional.ts": "const { candidate } = { ...{ candidate: ready && load() } };",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions passed to calls", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"call-conditional.ts": "const candidate = identity(ready && load());",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions used as element keys", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"element-conditional.ts": "const candidate = values[ready && load()];",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions under non-null assertions", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"non-null-conditional.ts": "const candidate = (ready && load())!;",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects non-null logical expressions passed to calls", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"non-null-call-conditional.ts": "report((ready && load())!);",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions under satisfies assertions", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"satisfies-conditional.ts": "const candidate = (ready && load()) satisfies string | false;",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in template interpolation", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"template-conditional.ts": "const candidate = `${ready && load()}`;",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects logical expressions in tagged templates", () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			"tagged-template-conditional.ts": "const candidate = String.raw`${ready && load()}`;",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});
});
