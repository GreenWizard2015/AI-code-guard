import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";
import { ARCHITECTURE_CASES, DIRECT_CASES, PROJECT_CASES } from "tests/language-parity/constants";

describe("coding lint language parity", () => {
	test("reports shared type and exception rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = DIRECT_CASES.slice(0, 5);
		const files = Object.fromEntries(
			cases.flatMap((item, index) => [
				[`case-${index}.ts`, item.typescript],
				[`case-${index}.py`, item.python],
			]),
		);
		const violations = fixture.with_shared_lint_request(
			lint_configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const results = cases.map((item, index) => {
			return [
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("keeps each language's file diagnostics independent in a mixed project", () => {
		const fixture = new TestFixture();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const typescript_file = "empty-handler.ts";
		const python_file = "empty-handler.py";
		const typescript_source = "try { run(); } catch {}\n";
		const python_source = "try:\n    run()\nexcept Exception:\n    pass\n";
		/** Responsibilities: _mixed language fixture execution_. **/
		const collect = (files: Record<string, string>): ReturnType<TestFixture["collect_fixture_violations"]> =>
			fixture.with_lint_request(
				configuration,
				files,
				(production_configuration, options, mode) =>
					production_configuration.lint_report(options, mode).report.violations,
			);
		/** Responsibilities: _source file diagnostic details_. **/
		const diagnostics = (violations: ReturnType<TestFixture["collect_fixture_violations"]>, file: string): string[] =>
			violations
				.filter((violation) => violation.file() === file)
				.map((violation) =>
					JSON.stringify([
						violation.rule_id(),
						violation.line(),
						violation.message(),
						violation.hint(),
						violation.priority(),
					]),
				)
				.sort();
		const typescript_only = diagnostics(collect({ [typescript_file]: typescript_source }), typescript_file);
		const python_only = diagnostics(collect({ [python_file]: python_source }), python_file);
		const mixed = collect({ [typescript_file]: typescript_source, [python_file]: python_source });

		expect({
			typescript_diagnostics_match: typescript_only.join() === diagnostics(mixed, typescript_file).join(),
			python_diagnostics_match: python_only.join() === diagnostics(mixed, python_file).join(),
			typescript_has_findings: typescript_only.length > 0,
			python_has_findings: python_only.length > 0,
		}).toEqual({
			typescript_diagnostics_match: true,
			python_diagnostics_match: true,
			typescript_has_findings: true,
			python_has_findings: true,
		});
	});

	test("retains full-project diagnostics when TypeScript files are selected in partitions", () => {
		const fixture = new TestFixture();
		const configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const files = {
			"src/service.ts": "export function service_only_in_tests(): void {}\n",
			"tests/service.test.ts": [
				'import { service_only_in_tests } from "../src/service";',
				"service_only_in_tests();",
			].join("\n"),
			"src/unused.ts": "export class UnusedClass {}\n",
			"source.py": "class UnusedClass:\n    pass\n",
			"tests/test_source.py": ["from source import UnusedClass", "instance = UnusedClass()"].join("\n"),
		};
		/** Responsibilities: _selected-file fixture report_. **/
		const collect = (selected_files: readonly string[] = []): ViolationContract[] =>
			fixture.with_lint_request(
				configuration,
				files,
				(production_configuration, options, mode) =>
					production_configuration.lint_report(options, mode).report.violations,
				selected_files,
			);
		/** Responsibilities: _stable diagnostic identity_. **/
		const identities = (violations: ReturnType<typeof collect>): string[] =>
			violations
				.map((violation) =>
					JSON.stringify([
						violation.rule_id(),
						violation.file(),
						violation.line(),
						violation.message(),
						violation.hint(),
						violation.priority(),
					]),
				)
				.sort();
		const complete = collect();
		const first_partition = collect(["src/service.ts", "src/unused.ts", "source.py"]);
		const second_partition = collect(["tests/service.test.ts", "tests/test_source.py"]);
		const partitioned = [...first_partition, ...second_partition];

		expect(identities(partitioned)).toEqual(identities(complete));
		expect(
			first_partition.some(
				(violation) => violation.rule_id() === "test-only-usage" && violation.file() === "src/service.ts",
			),
		).toBe(true);
	});

	test("reports shared value and construction rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = DIRECT_CASES.slice(5);
		const files = Object.fromEntries(
			cases.flatMap((item, index) => [
				[`case-${index}.ts`, item.typescript],
				[`case-${index}.py`, item.python],
			]),
		);
		const violations = fixture.with_shared_lint_request(
			lint_configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const results = cases.map((item, index) => {
			return [
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared ownership rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = ARCHITECTURE_CASES.slice(0, 7);
		const files = Object.fromEntries(
			cases.flatMap((item, index) => [
				[`case-${index}.ts`, item.typescript],
				[`case-${index}.py`, item.python],
			]),
		);
		const violations = fixture.with_shared_lint_request(
			lint_configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const results = cases.map((item, index) => {
			return [
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared contract and architecture rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = ARCHITECTURE_CASES.slice(7);
		const files = Object.fromEntries(
			cases.flatMap((item, index) => [
				[`case-${index}.ts`, item.typescript],
				[`case-${index}.py`, item.python],
			]),
		);
		const violations = fixture.with_shared_lint_request(
			lint_configuration,
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const results = cases.map((item, index) => {
			return [
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared import rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = PROJECT_CASES.slice(0, 4);
		const results = cases.map((item) => {
			const typescript_files = Object.fromEntries(item.typescript);
			const python_files = Object.fromEntries(item.python);
			const violations = fixture.with_shared_lint_request(
				lint_configuration,
				{ ...typescript_files, ...python_files },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			return [
				violations.some((violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(".ts")),
				violations.some((violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(".py")),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared placement and ownership metrics for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd()));
		const cases = PROJECT_CASES.slice(4);
		const results = cases.map((item) => {
			const typescript_files = Object.fromEntries(item.typescript);
			const python_files = Object.fromEntries(item.python);
			const violations = fixture.with_shared_lint_request(
				lint_configuration,
				{ ...typescript_files, ...python_files },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			return [
				violations.some((violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(".ts")),
				violations.some((violation) => violation.rule_id() === item.rule_id && violation.file().endsWith(".py")),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});
});
