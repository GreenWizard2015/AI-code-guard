import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import {
	MIXED_MODULE_DECLARATION_FILES,
	OVERSIZED_MODULE_FILES,
	SMALL_MODULE_DECLARATION_FILES,
	UNLIMITED_CONSTANT_FILES,
} from "tests/bridge/ts/core/constants";

describe("coding-lint module constants", () => {
	test("reports module declarations in TypeScript and Python", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			OVERSIZED_MODULE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			typescript: violations.filter((item) => {
				if (item.rule_id !== "module-constants-separation") {
					return false;
				}
				return item.file.endsWith("service.ts");
			}).length,
			python: violations.filter((item) => {
				if (item.rule_id !== "module-constants-separation") {
					return false;
				}
				return item.file.endsWith("service.py");
			}).length,
		}).toEqual({ typescript: 1, python: 1 });
	});

	test("accepts focused type and protocol modules", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"analysis_types.ts": "export type AnalysisOptions = { enabled: boolean };",
				"cache_protocols.ts": "export interface CacheContract { read(key: string): string; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => ["module-types-separation", "module-protocols-separation"].includes(item.rule_id)),
		).toEqual([]);
	});

	test("reports module declarations without a size threshold", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			SMALL_MODULE_DECLARATION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			typescript: violations.filter((item) => item.file.endsWith("service.ts")).map((item) => item.rule_id),
			python: violations.filter((item) => item.file.endsWith("service.py")).map((item) => item.rule_id),
		}).toEqual({
			typescript: expect.arrayContaining([
				"module-constants-separation",
				"module-types-separation",
				"module-protocols-separation",
			]),
			python: expect.arrayContaining([
				"module-constants-separation",
				"module-types-separation",
				"module-protocols-separation",
			]),
		});
	});

	test("applies the maximum file size to constants modules", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			UNLIMITED_CONSTANT_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			typescript_content: violations.filter((item) => {
				if (item.rule_id !== "constants-file-content") {
					return false;
				}
				return item.file.endsWith("constants.ts");
			}).length,
			python_content: violations.filter((item) => {
				if (item.rule_id !== "constants-file-content") {
					return false;
				}
				return item.file.endsWith("constants.py");
			}).length,
			typescript_max: violations.some((item) => {
				if (!item.file.endsWith("constants.ts")) {
					return false;
				}
				return item.rule_id === "file-max-size";
			}),
		}).toEqual({ typescript_content: 3, python_content: 3, typescript_max: true });
	});

	test("suggests the sibling constants file", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"a/b/service.ts":
					"const OPTIONS = {\n  first: true,\n  second: true,\n  third: true,\n  fourth: true,\n  fifth: true,\n  sixth: true,\n  seventh: true,\n  eighth: true,\n  ninth: true,\n  tenth: true,\n  eleventh: true,\n  twelfth: true,\n  thirteenth: true,\n  fourteenth: true,\n  fifteenth: true,\n};",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			dedicated: violations.some((item) => item.message.includes("a/b/constants.ts")),
			focused: violations.some((item) => item.message.includes("or a focused file")),
		}).toEqual({ dedicated: true, focused: true });
	});

	test("reports all module declarations in ordinary files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			MIXED_MODULE_DECLARATION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			typescript: violations.filter((item) => item.file.endsWith("service.ts")).map((item) => item.rule_id),
			python: violations.filter((item) => item.file.endsWith("service.py")).map((item) => item.rule_id),
		}).toEqual({
			typescript: expect.arrayContaining([
				"module-constants-separation",
				"module-types-separation",
				"module-protocols-separation",
			]),
			python: expect.arrayContaining([
				"module-constants-separation",
				"module-types-separation",
				"module-protocols-separation",
			]),
		});
	});

	test("reports constants declared inside namespaces", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"namespace-service.ts": [
					"namespace Feature {",
					"  const MAX_LIMIT = 3;",
					"  export function current_limit(): number { return MAX_LIMIT; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "module-constants-separation")).toHaveLength(1);
	});

	test("reports Final constants inside module control flow", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"conditional-service.py": ["from typing import Final", "if True:", "    request_limit: Final[int] = 3"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "module-constants-separation")).toHaveLength(1);
	});
});
