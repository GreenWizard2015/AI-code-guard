import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

import { COMPOSITION_FILES, GROUPED_PROTOCOL_FILES } from "tests/core/constants/architecture/constants";

describe("coding-lint architecture and metrics rules - grouped contracts", () => {
	test("ignores minimum size for the only file in a code category", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"python_single/request_data.py": [
					"from dataclasses import dataclass",
					"@dataclass",
					"class RequestData:",
					"    value: str",
				].join("\n"),
				"python_single/worker.py": "class Worker:\n    pass",
				"typescript_single/helper.ts": "export function helper(): void {}",
				"typescript_single/worker.ts": "export class Worker {}",
				"fallback_single/imports.py": "import math",
				"fallback_group/imports_one.py": "import math",
				"fallback_group/imports_two.py": "import os",
				"fallback_ts_single/import.ts": 'import { value } from "./value"; export { value };',
				"fallback_ts_group/import_one.ts": 'import { value } from "./value"; export { value };',
				"fallback_ts_group/import_two.ts": 'import { other } from "./other"; export { other };',
				"shared/reader_one.py": [
					"from typing import Protocol",
					"",
					"class ReaderContract(Protocol):",
					"    def content_for(self, key: str) -> str: ...",
				].join("\n"),
				"shared/reader_two.py": [
					"from typing import Protocol",
					"",
					"class WriterContract(Protocol):",
					"    def write(self, value: str) -> None: ...",
				].join("\n"),
				"shared/reader_one.ts": "export interface ReaderContract { read(): string; }",
				"shared/reader_two.ts": "export interface WriterContract { write(value: string): void; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "file-min-size")
				.map((item) => item.file())
				.sort(),
		).toEqual([
			"fallback_group/imports_one.py",
			"fallback_group/imports_two.py",
			"fallback_ts_group/import_one.ts",
			"fallback_ts_group/import_two.ts",
			"shared/reader_one.py",
			"shared/reader_one.ts",
			"shared/reader_two.py",
			"shared/reader_two.ts",
		]);
		expect(
			violations.some((item) => item.file() === "fallback_single/imports.py" && item.rule_id() === "file-min-size"),
		).toBe(false);
	});

	test("ignores minimum size for a single Python protocol file", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			GROUPED_PROTOCOL_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			short: violations.some((item) => item.message() === "file is too short"),
			protocol: violations.some((item) => item.rule_id() === "python-protocol-grouping"),
			multiple_classes: violations.some((item) => item.message() === "file contains too many top-level classes"),
		}).toEqual({ short: false, protocol: false, multiple_classes: false });
	});

	test("suggests grouping a lone exception class", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"single-error.ts": "export class SingleError extends Error {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((item) => ({ message: item.message(), priority: item.priority() }))).toContainEqual({
			message: "exception class should be colocated with its caller",
			priority: 5,
		});
	});

	test("does not suggest exception grouping when the caller is colocated", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"agent-response.ts": [
					"export class AgentValidationError extends Error {}",
					"export function parse_agent_response(): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((item) => item.message())).not.toContain(
			"exception class should be colocated with its caller",
		);
	});

	test("allows small dataclass and exception files", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"small-data.py": [
					"from dataclasses import dataclass",
					"",
					"@dataclass",
					"class SmallData:",
					"    value: str",
				].join("\n"),
				"small-error.ts": "export class SmallError extends Error {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter(
				(violation) =>
					(violation.file() === "small-data.py" || violation.file() === "small-error.ts") &&
					violation.message().includes("file has"),
			),
		).toHaveLength(0);
	});

	test("rejects nested classes in TypeScript and Python", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"nested-class.ts": ["class Outer {", "  static Inner = class Inner {};", "}"].join("\n"),
				"nested-class.py": ["class Outer:", "    class Inner:", "        pass"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());

		expect(messages).toEqual(expect.arrayContaining(["nested classes are not allowed (1)"]));
		expect(messages.filter((message) => message === "nested classes are not allowed (1)")).toHaveLength(2);
	});

	test("rejects nested classes in functions and object expressions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"nested-expressions.ts": [
					"const create = () => class FunctionInner {};",
					"const holder = { inner: class ObjectInner {} };",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());

		expect(messages).toContain("nested classes are not allowed (2)");
	});

	test("allows a class declared directly in a namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"status_model.ts": ["export namespace StatusModel {", "  export class StatusBoard {}", "}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((item) => item.rule_id())).not.toContain("nested-class");
	});

	test("reports composition deeper than three classes", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			COMPOSITION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());

		expect(messages).toContain(
			"class composition is too deep (found 4 levels): CompositionRoot -> CompositionMiddle -> CompositionLeaf -> CompositionEnd",
		);
	});
});
