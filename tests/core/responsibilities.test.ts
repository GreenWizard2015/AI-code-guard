import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Responsibilities documentation rule", () => {
	test("accepts documented TypeScript ownership boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": [
					"/** Responsibilities: _manage records, cache records_, _expose status_. **/",
					"class Service {",
					"  /** Responsibilities: _manage records_. **/",
					"  run(): void {}",
					"}",
					"type RecordValue = string;",
					"type PrimitiveValue = string | number;",
					"type Status = 'ready';",
					"/** Responsibilities: _load records_. **/",
					'function load(): RecordValue { return ""; }',
					"/** Responsibilities: _expose records_. **/",
					"interface RecordsPort {",
					"  load(): RecordValue;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id() === "responsibilities")).toHaveLength(0);
	});

	test("accepts documented Python ownership boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.py": [
					"from dataclasses import dataclass",
					"from typing import Protocol",
					"",
					"class Service:",
					'    """Responsibilities: _manage records, cache records_, _expose status_."""',
					"    def run(self):",
					'        """Responsibilities: _manage records_."""',
					"        return None",
					"",
					"def load():",
					'    """Responsibilities: _load records_."""',
					'    return ""',
					"",
					"class RecordsPort(Protocol):",
					'    """Responsibilities: _expose records_."""',
					"    def load(self):",
					"        ...",
					"",
					"@dataclass(frozen=True)",
					"class Options:",
					'    """Responsibilities: _construction options_."""',
					"    source: str",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id() === "responsibilities")).toHaveLength(0);
	});

	test("ignores TypeScript and Python type aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"aliases.ts": [
					"type RecordValue = string;",
					"type PrimitiveValue = string | number;",
					"type Status = 'ready';",
				].join("\n"),
				"aliases.py": [
					"from typing import TypeAlias",
					"",
					"RecordValue: TypeAlias = str",
					'"""Responsibilities: _represent records_."""',
					"PrimitiveValue: TypeAlias = str | int",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id().startsWith("responsibilities"))).toHaveLength(0);
	});

	test("requires paired underscores using the existing responsibility rule", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": ["/** Responsibilities: load records, cache records. **/", "function load(): void {}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.map((item) => ({ rule_id: item.rule_id(), message: item.message() }))).toEqual(
			expect.arrayContaining([
				{
					rule_id: "responsibilities",
					message: "violates the Responsibilities contract: use paired underscores around each responsibility",
				},
			]),
		);
	});

	test("requires one Responsibilities line and an explicit object per entry", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"responsibilities.ts": [
					"/** Responsibilities: _source loading_.",
					" * Responsibilities: _cache update_. **/",
					"function load(): void {}",
					"/** Responsibilities: _validation_. **/",
					"function validate(): void {}",
				].join("\n"),
				"responsibilities.py": [
					"def load() -> None:",
					'    """Responsibilities: _source loading_.',
					'    Responsibilities: _cache update_."""',
					"    return None",
					"",
					"def validate() -> None:",
					'    """Responsibilities: _validation_."""',
					"    return None",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "responsibilities")
				.map((item) => item.message())
				.sort(),
		).toEqual(
			[
				"violates the Responsibilities contract: name an explicit object for each responsibility",
				"violates the Responsibilities contract: use exactly one Responsibilities line",
			]
				.sort()
				.flatMap((message) => [message, message]),
		);
	});

	test("requires the double-star comment closing", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": ["/** Responsibilities: _load records_. */", "function load(): void {}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.map((item) => ({ rule_id: item.rule_id(), message: item.message() }))).toEqual(
			expect.arrayContaining([
				{
					rule_id: "responsibilities",
					message: "violates the Responsibilities contract: use paired underscores around each responsibility",
				},
			]),
		);
	});

	test("enforces responsibility limits", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": [
					"/** Responsibilities: _one value_, _two values_, _three values_, _four values_, _five values_. **/",
					"class Service {",
					"  /** Responsibilities: _unrelated behavior_. **/",
					"  run(): void {}",
					"}",
				].join("\n"),
				"service.py": [
					"class Service:",
					'    """Responsibilities: _one value_, _two values_."""',
					"    def run(self):",
					'        """Responsibilities: _one value_, _two values_, _three values_."""',
					"        return None",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const responsibility_violations = violations.filter((item) => item.rule_id().startsWith("responsibilities"));
		expect(responsibility_violations).toHaveLength(2);
		expect(responsibility_violations.every((item) => item.message() === "has too many responsibilities")).toBe(true);
	});

	test("requires documentation for functions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": "function load(): void {}",
				"service.py": "def load():\n    return None",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const responsibility_violations = violations.filter((item) => item.rule_id() === "responsibilities");
		expect(responsibility_violations).toHaveLength(2);
		expect(
			responsibility_violations.every(
				(item) => item.message() === "violates the Responsibilities contract: missing a Responsibilities line",
			),
		).toBe(true);
	});

	test("does not require documentation for interface methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"ports.ts": [
					"/** Responsibilities: _expose data_. **/",
					"interface Port {",
					"  read(): string;",
					"  write(value: string): void;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id() === "responsibilities")).toHaveLength(0);
	});
});
