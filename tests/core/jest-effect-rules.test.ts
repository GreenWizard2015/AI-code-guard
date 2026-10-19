import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Jest setup and effect rules", () => {
	test("reports oversized setup hooks and unobserved asynchronous work", () => {
		const fixture = new TestFixture();
		const setup_calls = [
			"create_database();",
			"configure_transport();",
			"load_environment();",
			"register_routes();",
			"seed_users();",
			"seed_messages();",
			"connect_clients();",
			"configure_browser();",
			"configure_logger();",
			"configure_metrics();",
			"configure_clock();",
			"configure_randomness();",
			"configure_cleanup();",
			"configure_assertions();",
			"configure_retry();",
			"configure_observers();",
		]
			.map((line) => `    ${line}`)
			.join("\n");
		const fixture_source = [
			"describe('fixture', () => {",
			"  beforeEach(() => {",
			setup_calls,
			"  });",
			"  test('result', () => { expect(true).toBe(true); });",
			"});",
		].join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/fixture-complexity.test.ts": fixture_source,
				"tests/async-completion.test.ts": [
					"async function load_result(): Promise<number> { return 1; }",
					"describe('async completion', () => {",
					"  test('misses completion', async () => {",
					"    load_result();",
					"    expect(true).toBe(true);",
					"  });",
					"  test('observes completion', async () => {",
					"    await load_result();",
					"    expect(true).toBe(true);",
					"  });",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			fixture_complexity: violations.filter((item) => item.rule_id === "fixture-complexity").length,
			unasserted_async: violations.filter((item) => item.rule_id === "unasserted-async-completion").length,
		}).toEqual({ fixture_complexity: 1, unasserted_async: 1 });
	});

	test("ignores effects hidden in uncalled helpers and respects shadowed declarations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/deferred-effects.test.ts": [
					"async function load_result(): Promise<number> { return 1; }",
					"const cache = new Map<string, number>();",
					"describe('deferred effects', () => {",
					"\ttest('first', async () => {",
					"\t\tfunction unused_helper(): void {",
					"\t\t\tload_result();",
					"\t\t\tDate.now();",
					"\t\t\tcache.set('first', 1);",
					"\t\t}",
					"\t\texpect(true).toBe(true);",
					"\t});",
					"\ttest('second', async () => {",
					"\t\tfunction another_unused_helper(): void {",
					"\t\t\tload_result();",
					"\t\t\tDate.now();",
					"\t\t\tcache.set('second', 2);",
					"\t\t}",
					"\t\texpect(true).toBe(true);",
					"\t});",
					"});",
				].join("\n"),
				"tests/shadowed-effects.test.ts": [
					"async function load_result(): Promise<number> { return 1; }",
					"const cache = new Map<string, number>();",
					"describe('shadowed effects', () => {",
					"\ttest('local values', async () => {",
					"\t\tconst load_result = (): number => 1;",
					"\t\tconst cache = new Map<string, number>();",
					"\t\tload_result();",
					"\t\tcache.set('local', 1);",
					"\t\texpect(load_result()).toBe(1);",
					"\t});",
					"\ttest('another local value', async () => {",
					"\t\tconst cache = new Map<string, number>();",
					"\t\tcache.set('other', 2);",
					"\t\texpect(cache.get('other')).toBe(2);",
					"\t});",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			async_completion: violations.filter((item) => item.rule_id === "unasserted-async-completion").length,
			time_dependency: violations.filter((item) => item.rule_id === "test-time-dependency").length,
			order_dependency: violations.filter((item) => item.rule_id === "test-order-dependency").length,
		}).toEqual({ async_completion: 0, time_dependency: 0, order_dependency: 0 });
	});
});
