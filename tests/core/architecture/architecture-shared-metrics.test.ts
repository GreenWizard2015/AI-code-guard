import { TestFixture } from "tests/core/test-fixture";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";

import {
	SHARED_THRESHOLD_FILES,
	SEPARATE_CLASS_FILES,
	METHOD_CANDIDATES_FILES,
	PROJECT_WIDE_PARAMETER_FILES,
	TYPE_OPERATION_FILES,
	EXTERNAL_TYPE_FILES,
	GENERIC_SIGNATURE_FILES,
} from "tests/core/constants";

describe("coding-lint architecture and metrics rules", () => {
	test("reports shared parameter types only after all thresholds", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			SHARED_THRESHOLD_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('multiple methods share parameter type "RecordData" (4)'),
					priority: 5,
				}),
				expect.objectContaining({
					message: expect.stringContaining('multiple functions share parameter type "RecordData" (4)'),
					priority: 5,
				}),
			]),
		);
	});

	test("does not group same-named types from separate files", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			SEPARATE_CLASS_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.message.includes('share parameter type "SharedInput"'))).toBe(false);
		expect(violations.some((item) => item.message.includes("multiple methods"))).toBe(false);
	});

	test("keeps imported Python type ownership when another file reuses its name", () => {
		const test_fixture = new TestFixture();
		const files = {
			"model.py": "class RequestData:\n    pass",
			"a.py": "from model import RequestData\ndef first(value: RequestData):\n    return value + value + value",
			"b.py": "from model import RequestData\ndef second(value: RequestData):\n    return value + value + value",
			"c.py": "from model import RequestData\ndef third(value: RequestData):\n    return value + value + value",
		};
		const baseline = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const with_unrelated_type = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				...files,
				"unrelated.py": "class RequestData:\n    pass",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _shared parameter values_. **/
		const shared = (violations: readonly { message: string }[]): { message: string }[] =>
			violations.filter((item) => item.message.includes('multiple functions share parameter type "RequestData"'));

		expect(shared(with_unrelated_type)).toHaveLength(shared(baseline).length);
		expect(shared(with_unrelated_type)).not.toHaveLength(0);
	});

	test("omits file names from method candidates", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			METHOD_CANDIDATES_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const diagnostic = violations.find((item) => item.message.includes("multiple methods"));
		expect(diagnostic?.message).toContain("Service.first");
		expect(diagnostic?.message).not.toContain("first.ts:");
	});

	test("reports project-wide function parameter types and combinations once", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			PROJECT_WIDE_PARAMETER_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const existing_rule_violations = violations.filter((item) => !item.rule_id.startsWith("responsibilities"));
		const request_message = existing_rule_violations.find((item) => item.message.includes("RequestData"));
		expect({
			type_count: existing_rule_violations.filter((item) =>
				item.message.includes('multiple functions share parameter type "RequestData"'),
			).length,
			combination_count: existing_rule_violations.filter((item) =>
				item.message.includes('multiple functions share parameter combination "CacheData, RequestData"'),
			).length,
			hint: request_message?.hint,
			message: request_message?.message,
		}).toEqual(
			expect.objectContaining({
				type_count: 1,
				combination_count: 1,
				hint: expect.stringContaining("focused wrapper"),
				message: expect.stringContaining("first.ts:"),
			}),
		);
		expect(request_message?.message).toContain("second.ts:");
	});

	test("reports type operations in production fixtures but not test fixtures", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			TYPE_OPERATION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			pick: messages.includes('avoid type operation "Pick"'),
			indexed: messages.includes('avoid type operation "indexed access"'),
			intersection: messages.includes('avoid type operation "intersection type"'),
			test_file: violations.some(
				(item) => item.file.endsWith("tests/type-operations.ts") && item.message.startsWith("avoid type operation"),
			),
			record: messages.includes('avoid type operation "Record"'),
		}).toEqual({ pick: true, indexed: true, intersection: true, test_file: false, record: false });
	});

	test("checks external types but ignores basic types", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			EXTERNAL_TYPE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			html: violations.some((item) => item.message.includes('share parameter type "HTMLElement"')),
			json: violations.some((item) => item.message.includes('share parameter type "JSON"')),
			promise: violations.some((item) => item.message.includes('share parameter type "Promise<Result>"')),
			template: violations.some((item) => item.message.includes('share parameter type "T"')),
			html_hint: violations
				.find((item) => item.message.includes('share parameter type "HTMLElement"'))
				?.hint.includes("wrapper"),
			promise_hint: violations
				.find((item) => item.message.includes('share parameter type "Promise<Result>"'))
				?.hint.includes("wrapper"),
		}).toEqual({ html: true, json: false, promise: true, template: false, html_hint: true, promise_hint: true });
	});

	test("reports generic parameter and return types", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			GENERIC_SIGNATURE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			unknown: violations.filter((item) => item.message.includes("uses unknown instead")).length,
			any: violations.filter((item) => item.message.includes("uses Any instead")).length,
			ts_concrete: violations.some(
				(item) => item.message.includes("generic-signatures.ts") && item.message.includes("concrete"),
			),
			python_concrete: violations.some(
				(item) => item.message.includes("generic-signatures.py") && item.message.includes("concrete"),
			),
		}).toEqual({ unknown: 2, any: 2, ts_concrete: false, python_concrete: false });
	});
});
