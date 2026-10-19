import { TestFixture } from "tests/core/test-fixture";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";

import { GROUPED_PROTOCOL_FILES, COMPOSITION_FILES } from "tests/core/constants";

describe("coding-lint architecture and metrics rules - grouped contracts", () => {
	test("reports a lone protocol in a small Python contract file", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"message_reader.py": [
					"from typing import Protocol",
					"",
					"class ReaderContract(Protocol):",
					"    def content_for(self, key: str) -> str: ...",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.rule_id === "python-protocol-grouping")).toBe(true);
	});

	test("allows small files with grouped protocol contracts", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			GROUPED_PROTOCOL_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			short: violations.some((item) => item.message === "file is too short"),
			protocol: violations.some(
				(item) => item.message === "small file contains a protocol contract" && item.priority === 2,
			),
			multiple_classes: violations.some((item) => item.message === "file contains too many top-level classes"),
		}).toEqual({ short: false, protocol: false, multiple_classes: false });
	});

	test("suggests grouping a lone exception class", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"single-error.ts": "export class SingleError extends Error {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "exception class should be colocated with its caller",
				priority: 7,
			}),
		);
	});

	test("does not suggest exception grouping when the caller is colocated", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"agent-response.ts": [
					"export class AgentValidationError extends Error {}",
					"export function parse_agent_response(): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "exception class should be colocated with its caller",
				}),
			]),
		);
	});

	test("allows small dataclass and exception files", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
					(violation.file === "small-data.py" || violation.file === "small-error.ts") &&
					violation.message.includes("file has"),
			),
		).toHaveLength(0);
	});

	test("rejects nested classes in TypeScript and Python", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-class.ts": ["class Outer {", "  static Inner = class Inner {};", "}"].join("\n"),
				"nested-class.py": ["class Outer:", "    class Inner:", "        pass"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(messages).toEqual(expect.arrayContaining(["nested classes are not allowed (1)"]));
		expect(messages.filter((message) => message === "nested classes are not allowed (1)")).toHaveLength(2);
	});

	test("rejects nested classes in functions and object expressions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-expressions.ts": [
					"const create = () => class FunctionInner {};",
					"const holder = { inner: class ObjectInner {} };",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(messages).toContain("nested classes are not allowed (2)");
	});

	test("reports composition deeper than three classes", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			COMPOSITION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(messages).toContain(
			"class composition is too deep (found 4 levels): CompositionRoot -> CompositionMiddle -> CompositionLeaf -> CompositionEnd",
		);
	});
});
