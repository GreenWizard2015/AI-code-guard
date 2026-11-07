import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { FORBIDDEN_SYNTAX_PROBE_FILES } from "tests/core/constants/ast_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("class ordering and runtime analysis", () => {
	test("enforces implementation-before-public ordering in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
				"multiple-order-issues.ts": [
					"class Sample {",
					"  public first() {}",
					"  public second() {}",
					"  constructor() {}",
					"  private helper() {}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const order_violations = violations.filter((item) => item.rule_id() === "method-order");
		const multiple_class_violations = order_violations.filter((item) =>
			item.file().endsWith("multiple-order-issues.ts"),
		);
		const typescript_constructor_violations = order_violations.filter((item) =>
			item.file().endsWith("constructor-order.ts"),
		);
		const python_constructor_violations = order_violations.filter((item) =>
			item.file().endsWith("constructor-order.py"),
		);
		expect({
			method_order: order_violations.length,
			multiple_class: multiple_class_violations.length,
			typescript_constructor_class: typescript_constructor_violations.length,
			python_constructor_class: python_constructor_violations.length,
			legacy_public: violations.some((item) => item.rule_id() === "method-order-public"),
			legacy_constructor_before: violations.some((item) => item.rule_id() === "method-order-constructor-before"),
			legacy_constructor_after: violations.some((item) => item.rule_id() === "method-order-constructor-after"),
		}).toEqual({
			method_order: 5,
			multiple_class: 1,
			typescript_constructor_class: 1,
			python_constructor_class: 1,
			legacy_public: false,
			legacy_constructor_before: false,
			legacy_constructor_after: false,
		});
	});

	test("detects forbidden syntax rules", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			FORBIDDEN_SYNTAX_PROBE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());
		const expected_messages = [
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
		];
		expect(expected_messages.filter((message) => !messages.includes(message))).toEqual([]);
	});

	test("detects prototype mutation, temporary indexing, and constructor-only initialization rules", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
					'  private readonly typescript_extensions = [".ts", ".tsx"];',
					'  private readonly disk_cache_enabled = process.env[NODE_ENV_VARIABLE] !== "test";',
					"  private readonly enabled = false;",
					'  private readonly language = "python" as const;',
					"  private readonly retry_count = -1;",
					'  private static readonly extension = ".ts";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			prototype_assignments: violations.filter((item) => item.rule_id() === "typescript-prototype-assignment").length,
			temporary_result_access: violations.filter((item) => item.rule_id() === "temporary-result-access").length,
			bind_calls: violations.filter((item) => item.rule_id() === "typescript-bind").length,
			complex_constructors: violations.filter((item) => item.rule_id() === "complex-constructor").length,
			field_initializers: violations
				.filter((item) => item.rule_id() === "field-in-constructor")
				.map((item) => ({ file: item.file(), line: item.line() }))
				.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
		}).toEqual({
			prototype_assignments: 4,
			temporary_result_access: 21,
			bind_calls: 1,
			complex_constructors: 2,
			field_initializers: [
				{ file: "field-cache.ts", line: 2 },
				{ file: "field-cache.ts", line: 3 },
				{ file: "field-cache.ts", line: 4 },
				{ file: "field-cache.ts", line: 5 },
				{ file: "field-cache.ts", line: 6 },
			],
		});
	});

	test("allows sorting and reading an assigned spread copy", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"sorted-files.ts": [
					'const files = ["first", "second"];',
					"const sorted_files = [...files];",
					"sorted_files.sort();",
					"sorted_files.join(',');",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const temporary_access = violations.filter(
			(item) => item.file() === "sorted-files.ts" && item.rule_id() === "temporary-result-access",
		);

		expect(temporary_access).toEqual([]);
	});
});
