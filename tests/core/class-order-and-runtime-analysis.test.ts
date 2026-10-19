import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { FORBIDDEN_SYNTAX_PROBE_FILES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("class ordering and runtime analysis", () => {
	test("enforces implementation-before-public ordering and detects forbidden syntax", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"public-before-private.ts": ["class Sample {", "  publicApi() {}", "  private helper() {}", "}"].join("\n"),
				"private-before-public.ts": ["class Sample {", "  private helper() {}", "  publicApi() {}", "}"].join("\n"),
				"python-public-before-private.py": [
					"class Sample:",
					"    def public_api(self):",
					"        return 1",
					"    def _helper(self):",
					"        return 2",
				].join("\n"),
				"python-private-before-public.py": [
					"class Sample:",
					"    def _helper(self):",
					"        return 2",
					"    def public_api(self):",
					"        return 1",
				].join("\n"),
				"constructor-order.ts": [
					"class Sample {",
					"  publicApi() {}",
					"  constructor() {}",
					"  private helper() {}",
					"}",
				].join("\n"),
				"constructor-order.py": [
					"class Sample:",
					"    def public_api(self):",
					"        return 1",
					"    def __init__(self):",
					"        self.value = 1",
					"    def _helper(self):",
					"        return 2",
				].join("\n"),
				...FORBIDDEN_SYNTAX_PROBE_FILES,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect(messages).toEqual(
			expect.arrayContaining([
				"public method publicApi must be declared after private/protected methods",
				"public method public_api must be declared after private/protected methods",
			]),
		);
		expect(messages).toEqual(
			expect.arrayContaining([
				"constructor must be declared before public methods",
				"constructor must be declared after private/protected methods",
				"avoid broad try/catch or try/except blocks",
				"catch one exception type per except handler",
				"avoid static methods",
				"avoid class methods",
				"avoid prototype-based class construction",
				"avoid .bind calls",
				"avoid dynamic class construction with type(...)",
				"avoid repeated isinstance checks in business logic",
				"avoid getattr for normal control flow",
				"avoid setattr for normal control flow",
				"avoid callable feature detection for project-owned interfaces",
				"avoid inferring tool results from multiple shapes",
				"avoid Object.prototype.toString.call",
				"avoid direct access through temporary results or spread copies",
				"function has too many arguments (found 6)",
			]),
		);
	});

	test("detects prototype mutation, temporary indexing, and constructor-only initialization rules", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"prototype-string.ts": ["class Constructor {}", "Constructor['prototype'].run = function run() {};"].join("\n"),
				"prototype-updates.ts": [
					"class Constructor { public value = 0; public read(): number { return this.value; } }",
					"Constructor.prototype.value += 1;",
					"Constructor.prototype.value++;",
					"Object['setPrototypeOf']({}, Constructor.prototype);",
				].join("\n"),
				"temporary.ts": [
					'void [...["rule"]].sort();',
					'void ({ ...{ mode: "fast" } }).mode;',
					'const rule_ids = ["rule"]; rule_ids.sort();',
					'const rule_options = { mode: "fast" }; rule_options.mode;',
					"new Date().toISOString();",
					"new Date().toString;",
					'new Date()["toISOString"]();',
					'const METHOD = "toISOString";',
					"new Date()[METHOD]();",
					'factory()["value"];',
					"factory()[key];",
					"factory()[key]();",
					"factory().items[key];",
					"factory()[key].value;",
					"factory().value; factory().run();",
					"const value = factory(); value.value; value[key];",
				].join("\n"),
				"temporary.py": [
					'[*["rule"]].sort()',
					'{**{"mode": "fast"}}["mode"]',
					'rule_ids = [*["rule"]]\nrule_ids.sort()',
					'options = {**{"mode": "fast"}}\noptions["mode"]',
					'factory()["value"]',
					"factory()[key]",
					"factory()[key]()",
					"factory().items[key]",
					"factory()[key].value",
					"factory().value; factory().run()",
					"Reader().read(); Reader().value",
					"value = factory()",
					"value.value",
					"value[key]",
				].join("\n"),
				"temporary-instance-parameter.ts": [
					"class Counter { public increment(value: number): number { return value; } }",
					'function run(method: "increment"): number { return new Counter()[method](1); }',
				].join("\n"),
				"bind-apply.ts": [
					"class Counter { public increment(value: number): number { return value; } }",
					"const counter = new Counter();",
					"const bind = counter.increment.bind;",
					"const callback = bind.apply(counter.increment, [counter]);",
					"callback(1);",
				].join("\n"),
				"constructor-work.ts": [
					"class Direct {",
					"  private readonly name: string;",
					"  constructor(name: string) { this.name = this.normalize(name); }",
					"  private normalize(name: string): string { return name.trim(); }",
					"}",
					"class Computed {",
					"  private readonly name: string;",
					'  constructor(name: string) { this["name"] = this.normalize(name) + "!"; }',
					"  private normalize(name: string): string { return name.trim(); }",
					"}",
				].join("\n"),
				"field-cache.ts": [
					"class CacheOwner {",
					"  private readonly values = new Map<string, string>();",
					"  private readonly aliases = new WeakMap<object, string>();",
					"  private readonly helper = new CacheHelper();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			prototype_assignments: violations.filter((item) => item.rule_id === "typescript-prototype-assignment").length,
			temporary_result_access: violations.filter((item) => item.rule_id === "temporary-result-access").length,
			bind_calls: violations.filter((item) => item.rule_id === "typescript-bind").length,
			complex_constructors: violations.filter((item) => item.rule_id === "complex-constructor").length,
			field_initializers: violations.filter((item) => item.rule_id === "field-in-constructor").length,
		}).toEqual({
			prototype_assignments: 4,
			temporary_result_access: 21,
			bind_calls: 1,
			complex_constructors: 2,
			field_initializers: 3,
		});
	});
});
