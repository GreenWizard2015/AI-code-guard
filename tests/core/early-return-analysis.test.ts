import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language early-return analysis", () => {
	test("finds terminal alternate branches in TypeScript and Python", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"simple.ts": [
					"function read(ready: boolean): string {",
					'  if (ready) { return "ready"; } else { return "waiting"; }',
					"}",
				].join("\n"),
				"simple.py": [
					"def read(ready: bool) -> str:",
					"    if ready:",
					'        return "ready"',
					"    else:",
					'        return "waiting"',
				].join("\n"),
				"nested.py": [
					"def resolve_state(outer: bool, inner: bool) -> str:",
					"    if outer:",
					"        if inner:",
					'            return "inner"',
					'        return "outer"',
					"    else:",
					'        return "fallback"',
				].join("\n"),
				"nested.ts": [
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
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const early_returns = violations.filter(
			(item) => item.message === "prefer an early return before the alternate branch",
		);
		expect(early_returns.map((item) => item.file)).toEqual(["nested.py", "nested.ts", "simple.py", "simple.ts"]);
	});

	test("recognizes terminal returns wrapped in control-flow constructs", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"alternate.ts": [
					"function read(ready: boolean): string {",
					'  if (ready) { return "ready"; } else {',
					"    log_waiting();",
					'    return "waiting";',
					"  }",
					"}",
				].join("\n"),
				"try-finally.py": [
					"def read(ready: bool) -> str:",
					"    if ready:",
					'        return "ready"',
					"    else:",
					"        try:",
					'            return "waiting"',
					"        finally:",
					"            pass",
				].join("\n"),
				"with.py": [
					"from contextlib import nullcontext",
					"def read(ready: bool) -> str:",
					"    if ready:",
					'        return "ready"',
					"    else:",
					"        with nullcontext():",
					'            return "waiting"',
				].join("\n"),
				"try-finally.ts": [
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
				"loop.ts": [
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
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const early_returns = violations.filter(
			(item) => item.message === "prefer an early return before the alternate branch",
		);
		expect(early_returns.map((item) => item.file)).toEqual(["loop.ts", "try-finally.py", "try-finally.ts", "with.py"]);
	});
});
