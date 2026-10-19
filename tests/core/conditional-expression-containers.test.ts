import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional execution expression containers", () => {
	test("reports conditional operators in expression containers", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"await.ts":
						"async function run(): Promise<string> { const candidate = await (ready && load()); return candidate; }",
					"return.ts":
						"function load_value(): boolean { return true; }\nfunction use_value(ready: boolean): boolean { return ready && load_value(); }",
					"yield.ts":
						"function* run(): Generator<string, void, unknown> { const candidate = yield (ready && load()); return; }",
					"constructor.ts": "const candidate = new String(ready && load());",
					"spread.ts": "const candidate = consume(...[ready && load()]);",
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "conditional-execution").length;
		expect(count).toBe(5);
	});

	test("reports conditional operators in call, property, IIFE, and parameter contexts", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"property.ts": "const candidate = (ready && load())?.count;",
					"arrow-iife.ts": "const candidate = (() => ready && load())();",
					"function-iife.ts": "const candidate = (function () { return ready && load(); })();",
					"standalone.ts": [
						"declare function load(): void;",
						"declare function recover(): void;",
						"ready && load();",
						"ready || recover();",
						"ready ?? load();",
					].join("\n"),
					"destructured-parameter.ts": [
						"declare function load(): string;",
						"export function selected(ready: boolean, { value = ready && load() }: { value?: string | false } = {}): string | false {",
						"\treturn value;",
						"}",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "conditional-execution").length;
		expect(count).toBe(7);
	});
});
