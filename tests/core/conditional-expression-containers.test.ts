import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional execution expression containers", () => {
	test("reports optional chaining as conditional execution", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"optional-call-argument.ts": [
					"declare const item: { value: string } | undefined;",
					"declare function consume(value: string | undefined): void;",
					"consume(item?.value);",
				].join("\n"),
				"optional-data-read.ts": [
					"declare const item: { value: string } | undefined;",
					"const value = item?.value;",
				].join("\n"),
				"optional-chain.ts": [
					"interface Violation { message(): string; line(): number; }",
					"function inspect(violations: Violation[]): boolean {",
					"  const message = violations[0]?.message().includes('run');",
					"  const line = violations[0]?.line();",
					"  return message === '' || line === 0;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.rule_id() === "conditional-execution");
		expect(findings.map((item) => item.line()).sort((left, right) => left - right)).toEqual([3, 4]);
	});

	test("reports conditional operators in expression containers", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			.filter((item) => item.rule_id() === "conditional-execution").length;
		expect(count).toBe(5);
	});

	test("reports conditional operators in call, property, IIFE, and parameter contexts", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			.filter((item) => item.rule_id() === "conditional-execution").length;
		expect(count).toBe(7);
	});

	test("allows pure nullish defaults and reports an effectful fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"pure-defaults.ts": [
					"declare const imports: readonly string[] | undefined;",
					"declare const options: { enabled: boolean } | undefined;",
					"const paths = imports ?? [];",
					"const settings = options ?? {};",
				].join("\n"),
				"effectful-fallback.ts": [
					"declare const imports: readonly string[] | undefined;",
					"declare function discover_imports(): readonly string[];",
					"const paths = imports ?? discover_imports();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.rule_id() === "conditional-execution");
		expect(findings.map((item) => item.file())).toEqual(["effectful-fallback.ts"]);
	});

	test("allows an unconditional lookup with a pure nullish fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "lookup-fallback.ts": "const resolved = aliases.get(name) ?? name;" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "conditional-execution")).toEqual([]);
	});

	test("preserves conditional execution classification across parenthesized AST contexts", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"parenthesized-contexts.ts": [
					"declare const enabled: boolean;",
					"declare function load_text(): string;",
					"const assigned = ((enabled && load_text()));",
					"((enabled && load_text()));",
					"if (((enabled && load_text()))) {}",
					'const selected = ((enabled && load_text())) ? load_text() : "fallback";',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.rule_id() === "conditional-execution");
		expect(findings.map((item) => item.line()).sort((left, right) => left - right)).toEqual([3, 4, 5, 6]);
	});

	test("allows unconditional non-boolean calls before boolean short-circuit predicates", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"state-predicates.ts": [
					"type State = { readonly test_file: boolean };",
					"class Context { state(): State { return { test_file: false }; } }",
					"class Rules {",
					"  private readonly context = new Context();",
					"  private hidden_property(): boolean { return false; }",
					"  private mutable_collection_field(): boolean { return false; }",
					"  check(): boolean {",
					"    if (this.context.state().source.test_file || this.hidden_property() || !this.mutable_collection_field()) {",
					"      return false;",
					"    }",
					"    return true;",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "conditional-execution")).toEqual([]);
	});
});
