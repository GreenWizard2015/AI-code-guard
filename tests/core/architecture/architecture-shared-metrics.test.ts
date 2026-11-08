import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";

import {
	EXTERNAL_TYPE_FILES,
	GENERIC_SIGNATURE_FILES,
	METHOD_CANDIDATES_FILES,
	PROJECT_WIDE_PARAMETER_FILES,
	SEPARATE_CLASS_FILES,
	SHARED_THRESHOLD_FILES,
	TYPE_OPERATION_FILES,
} from "tests/core/constants/architecture/constants";

describe("coding-lint architecture and metrics rules", () => {
	test("reports shared parameter sets only after all thresholds", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			SHARED_THRESHOLD_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((item) => ({ message: item.message(), priority: item.priority() }))).toEqual(
			expect.arrayContaining([
				{
					message: expect.stringContaining('multiple methods share parameter set "data:RecordData" (4)'),
					priority: 5,
				},
				{
					message: expect.stringContaining('multiple functions share parameter set "data:RecordData" (4)'),
					priority: 5,
				},
			]),
		);
	});

	test("does not group same-named types from separate files", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			SEPARATE_CLASS_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.message().includes('share parameter set "input:SharedInput"'))).toBe(false);
		expect(violations.some((item) => item.message().includes("multiple methods"))).toBe(false);
	});

	test("keeps imported Python type ownership when another file reuses its name", () => {
		const test_fixture = new TestFixture();
		const files = {
			"model.py": "class RequestData:\n    pass",
			"a.py": "from model import RequestData\ndef first(value: RequestData):\n    return value + value + value",
			"b.py": "from model import RequestData\ndef second(value: RequestData):\n    return value + value + value",
			"c.py": "from model import RequestData\ndef third(value: RequestData):\n    return value + value + value",
		};
		const with_unrelated_type = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...files,
				"unrelated.py": "class RequestData:\n    pass",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _shared-parameter violation selection_. **/
		const shared = (violations: readonly ViolationContract[]): ViolationContract[] =>
			violations.filter((item) =>
				item.message().includes('multiple functions share parameter set "value:RequestData"'),
			);

		expect(
			shared(with_unrelated_type).map((item) => ({ file: item.file(), line: item.line(), message: item.message() })),
		).toEqual([
			{
				file: "a.py",
				line: 2,
				message:
					'multiple functions share parameter set "value:RequestData" (3). Candidates: a.py:2 first; b.py:2 second; c.py:2 third.',
			},
		]);
	});

	test("omits file names from method candidates", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			METHOD_CANDIDATES_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const diagnostic_messages = violations
			.filter((item) => item.message().includes("multiple methods"))
			.map((item) => item.message());
		expect(diagnostic_messages.some((message) => message.includes("Service.first"))).toBe(true);
		expect(diagnostic_messages.some((message) => message.includes("first.ts:"))).toBe(false);
	});

	test("reports project-wide function parameter sets once", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			PROJECT_WIDE_PARAMETER_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const existing_rule_violations = violations.filter((item) => !item.rule_id().startsWith("responsibilities"));
		const request_messages = existing_rule_violations.filter((item) => item.message().includes("request:RequestData"));
		expect({
			set_count: existing_rule_violations.filter((item) =>
				item.message().includes('multiple functions share parameter set "cache:CacheData, request:RequestData"'),
			).length,
			hint: request_messages.some((item) => item.hint().includes("name:type")),
			message: request_messages.some((item) => item.message().includes("first.ts:")),
		}).toEqual({ set_count: 1, hint: true, message: true });
		expect(request_messages.some((item) => item.message().includes("second.ts:"))).toBe(true);
	});

	test("reports type operations in production fixtures but not test fixtures", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			TYPE_OPERATION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());
		expect({
			pick: messages.includes('avoid type operation "Pick"'),
			indexed: messages.includes('avoid type operation "indexed access"'),
			intersection: messages.includes('avoid type operation "intersection type"'),
			test_file: violations.some(
				(item) => item.file().endsWith("tests/type-operations.ts") && item.message().startsWith("avoid type operation"),
			),
			record: messages.includes('avoid type operation "Record"'),
		}).toEqual({ pick: true, indexed: true, intersection: true, test_file: false, record: false });
	});

	test("checks external types but ignores basic types", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			EXTERNAL_TYPE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			html: violations.some((item) => item.message().includes('share parameter set "element:HTMLElement"')),
			json: violations.some((item) => item.message().includes('share parameter set "value:JSON"')),
			promise: violations.some((item) => item.message().includes('share parameter set "value:Promise<Result>"')),
			template: violations.some((item) => item.message().includes('share parameter set "value:T"')),
			html_hint: violations.some(
				(item) =>
					item.message().includes('share parameter set "element:HTMLElement"') && item.hint().includes("name:type"),
			),
			promise_hint: violations.some(
				(item) =>
					item.message().includes('share parameter set "value:Promise<Result>"') && item.hint().includes("name:type"),
			),
		}).toEqual({ html: true, json: true, promise: true, template: false, html_hint: true, promise_hint: true });
	});

	test("reports generic parameter and return types", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			GENERIC_SIGNATURE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			unknown: violations.filter((item) => item.message().includes("uses unknown instead")).length,
			any: violations.filter((item) => item.message().includes("uses Any instead")).length,
			ts_concrete: violations.some(
				(item) => item.message().includes("generic-signatures.ts") && item.message().includes("concrete"),
			),
			python_concrete: violations.some(
				(item) => item.message().includes("generic-signatures.py") && item.message().includes("concrete"),
			),
		}).toEqual({ unknown: 2, any: 2, ts_concrete: false, python_concrete: false });
	});
});
