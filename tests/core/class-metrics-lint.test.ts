import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import { DECORATED_PLUGIN_SOURCE, SPECIALIZATION_SOURCE } from "tests/core/constants";

describe("coding-lint class metrics rules", () => {
	test("reports TypeScript class thresholds, callback fields, and contract exemptions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"specialization.ts": SPECIALIZATION_SOURCE,
				"callbacks.ts": [
					"const callback = () => 1;",
					"const [array_callback] = [() => 2];",
					"class InlineCallbacks {",
					"  on_one = () => 1; on_two = () => 2; on_three = () => 3; on_four = () => 4;",
					"  run() {} reset() {}",
					"}",
					"class AliasedCallbacks { handler = callback; run() {} reset() {} }",
					"class ArrayAliasedCallbacks { handler = array_callback; run() {} reset() {} }",
					"interface Contract { run(): void; }",
					"class Adapter implements Contract { run() {} }",
					"class QualifiedAdapter implements External.Contract { run() {} }",
					"class Base { run() {} } class InheritedAdapter extends Base { run() {} }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const details = violations.map((item) => [item.message, item.priority, item.rule_id]);

		expect({
			class_thresholds: details,
			info_count: details.filter((item) => item[0] === "class has many public methods (found 6)").length,
			four_callbacks: violations.filter(
				(item) => item.message === "class has 4 callback fields with default implementations",
			).length,
			one_callback: violations.filter(
				(item) => item.message === "class has 1 callback fields with default implementations",
			).length,
			callback_class_minimum: violations.filter(
				(item) => item.file === "callbacks.ts" && item.message === "class has too few public methods (found 1)",
			).length,
		}).toEqual({
			class_thresholds: expect.arrayContaining([
				["class has too few public methods (found 1)", 6, "class-method-min-count"],
				["class has many public methods (found 6)", 1, "class-method-count-info"],
				["class has too many public methods (found 16)", 3, "class-method-max-count"],
			]),
			info_count: 3,
			four_callbacks: 1,
			one_callback: 2,
			callback_class_minimum: 1,
		});
	});

	test("preserves Python protocol and plugin method-count exemptions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"protocol.py": [
					"from typing import Protocol",
					"class Contract(Protocol):",
					"    def run(self) -> None: ...",
					"class Adapter(Contract):",
					"    def run(self) -> None:",
					"        return None",
				].join("\n"),
				"plugin.py": DECORATED_PLUGIN_SOURCE,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			minimum_method_count: violations.filter((item) => item.message === "class has too few public methods (found 1)")
				.length,
			method_count_info: violations.filter((item) => item.rule_id === "class-method-count-info").length,
			unused_plugin_callables: violations.filter(
				(item) => item.file === "plugin.py" && item.rule_id === "unused-callable",
			).length,
		}).toEqual({ minimum_method_count: 0, method_count_info: 0, unused_plugin_callables: 0 });
	});
});
