import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint early-return rule", () => {
	test("prefers early returns over an else branch after return", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.ts": [
				"function read(ready: boolean): string {",
				'  if (ready) { return "ready"; } else { return "waiting"; }',
				"}",
			].join("\n"),
			"early-return.py": [
				"def read(ready: bool) -> str:",
				"    if ready:",
				'        return "ready"',
				"    else:",
				'        return "waiting"',
			].join("\n"),
		});

		expect(messages.filter((message) => message === "prefer an early return before the alternate branch")).toHaveLength(
			2,
		);
	});

	test("allows an alternate branch that does not only return", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.ts": [
				"function read(ready: boolean): string {",
				'  if (ready) { return "ready"; } else {',
				"    log_waiting();",
				'    return "waiting";',
				"  }",
				"}",
			].join("\n"),
		});

		expect(messages).not.toContain("prefer an early return before the alternate branch");
	});

	test("recognizes a return wrapped in Python try-finally", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.py": [
				"def read(ready: bool) -> str:",
				"    if ready:",
				'        return "ready"',
				"    else:",
				"        try:",
				'            return "waiting"',
				"        finally:",
				"            pass",
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});

	test("recognizes a return wrapped in Python with", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.py": [
				"from contextlib import nullcontext",
				"def read(ready: bool) -> str:",
				"    if ready:",
				'        return "ready"',
				"    else:",
				"        with nullcontext():",
				'            return "waiting"',
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});

	test("recognizes nested terminal Python branches", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.py": [
				"def resolve_state(outer: bool, inner: bool) -> str:",
				"    if outer:",
				"        if inner:",
				'            return "inner"',
				'        return "outer"',
				"    else:",
				'        return "fallback"',
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});

	test("recognizes nested terminal TypeScript branches", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.ts": [
				"function resolve_state(outer: boolean, inner: boolean): string {",
				"    if (outer) {",
				"        if (inner) {",
				'            return "inner";',
				"        }",
				'        return "outer";',
				"    } else {",
				'        return "fallback";',
				"    }",
				"}",
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});

	test("recognizes a return wrapped in TypeScript try-finally", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.ts": [
				"function read(ready: boolean): string {",
				"    if (ready) {",
				'        return "ready";',
				"    } else {",
				"        try {",
				'            return "waiting";',
				"        } finally {",
				"            cleanup();",
				"        }",
				"    }",
				"}",
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});

	test("recognizes a return wrapped in a TypeScript infinite loop", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"early-return.ts": [
				"function read(ready: boolean): string {",
				"    if (ready) {",
				'        return "ready";',
				"    } else {",
				"        while (true) {",
				'            return "waiting";',
				"        }",
				"    }",
				"}",
			].join("\n"),
		});

		expect(messages).toContain("prefer an early return before the alternate branch");
	});
});
