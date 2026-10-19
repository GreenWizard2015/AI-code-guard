import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";
import { ARCHITECTURE_CASES, DIRECT_CASES, PROJECT_CASES } from "tests/language-parity/constants";

describe("coding lint language parity", () => {
	test("reports shared type and exception rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
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
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared value and construction rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
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
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared ownership rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
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
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared contract and architecture rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
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
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.ts`),
				),
				violations.some(
					(violation) => violation.rule_id === item.rule_id && violation.file.endsWith(`case-${index}.py`),
				),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared import rules for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
		const cases = PROJECT_CASES.slice(0, 4);
		const results = cases.map((item) => {
			const violations = fixture.with_shared_lint_request(
				lint_configuration,
				{ ...item.typescript, ...item.python },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			return [
				violations.some((violation) => violation.rule_id === item.rule_id && violation.file.endsWith(".ts")),
				violations.some((violation) => violation.rule_id === item.rule_id && violation.file.endsWith(".py")),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});

	test("reports shared placement and ownership metrics for both languages", () => {
		const fixture = new TestFixture();
		const lint_configuration = new LintRunConfiguration(new SourceText(), new NodeFileIO());
		const cases = PROJECT_CASES.slice(4);
		const results = cases.map((item) => {
			const violations = fixture.with_shared_lint_request(
				lint_configuration,
				{ ...item.typescript, ...item.python },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			return [
				violations.some((violation) => violation.rule_id === item.rule_id && violation.file.endsWith(".ts")),
				violations.some((violation) => violation.rule_id === item.rule_id && violation.file.endsWith(".py")),
			];
		});
		expect(results).toEqual(cases.map(() => [true, true]));
	});
});
