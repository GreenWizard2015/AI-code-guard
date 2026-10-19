import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { PYTHON_STATE_ANALYSIS_FILES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language project state analysis", () => {
	test("reports shared test state and uncontrolled time dependencies", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/shared-state.test.ts": [
					"const shared: number[] = [];",
					"describe('shared state', () => {",
					"\ttest('first', () => { shared.push(1); expect(shared).toHaveLength(1); });",
					"\ttest('second', () => { shared.push(2); expect(shared).toHaveLength(2); });",
					"});",
				].join("\n"),
				"tests/test_shared_state.py": [
					"import unittest",
					"shared: list[int] = []",
					"class SharedStateTests(unittest.TestCase):",
					"    def test_first(self) -> None:",
					"        shared.append(1)",
					"        self.assertEqual(len(shared), 1)",
					"    def test_second(self) -> None:",
					"        shared.append(2)",
					"        self.assertEqual(len(shared), 2)",
				].join("\n"),
				"tests/clock.test.ts": [
					"describe('clock', () => {",
					"  test('reads clock', () => { Date.now(); Math.random(); new Date(); expect(true).toBe(true); });",
					"});",
				].join("\n"),
				"tests/test_clock.py": [
					"from datetime import datetime",
					"import random",
					"import time",
					"import unittest",
					"class TestClock(unittest.TestCase):",
					"    def test_clock(self):",
					"        time.time()",
					"        random.random()",
					"        datetime.now()",
					"        self.assertTrue(True)",
				].join("\n"),
				"service.ts": "function read_clock(): number { return Date.now(); }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-order-dependency")).toHaveLength(2);
		expect(violations.filter((item) => item.rule_id === "test-time-dependency")).toHaveLength(6);
	});

	test("reports callable structure, Python expressions, and test fixture complexity", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			PYTHON_STATE_ANALYSIS_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			nesting: violations.filter((item) => item.rule_id === "callable-nesting-depth").length,
			assignment_expression: violations.filter((item) => item.rule_id === "python-assignment-expression").length,
			ternary: violations.filter((item) => {
				if (item.message !== "avoid ternary expressions") {
					return false;
				}
				return item.file.startsWith("primitive-ternaries");
			}).length,
			fixture: violations.filter((item) => item.rule_id === "fixture-complexity").length,
			branch_count: violations.filter((item) => item.rule_id === "callable-branch-count").length,
		}).toEqual({ nesting: 2, assignment_expression: 1, ternary: 3, fixture: 1, branch_count: 4 });
	});

	test("reports mutable state and hidden initialization order", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"hidden-global-state.ts": [
					"const pending = new Map<string, Request>();",
					"function enqueue(request: Request): void { pending.set(request.id, request); }",
					"function cancel(id: string): void { pending.delete(id); }",
				].join("\n"),
				"hidden_global_state.py": [
					"pending: dict[str, Request] = {}",
					"def enqueue(request: Request) -> None:",
					"    pending.update({request.id: request})",
					"def cancel(identifier: str) -> None:",
					"    pending.pop(identifier, None)",
				].join("\n"),
				"single-owner.ts": [
					"const local = new Set<string>();",
					"function add(value: string): void { local.add(value); }",
				].join("\n"),
				"temporal-coupling.ts": [
					"class Session {",
					"    connect(): void { this.socket = open_socket(); }",
					"    send(message: string): void { this.socket.send(message); }",
					"}",
				].join("\n"),
				"temporal_coupling.py": [
					"class Session:",
					"    def connect(self) -> None:",
					"        self.socket = open_socket()",
					"    def send(self, message: str) -> None:",
					"        self.socket.send(message)",
				].join("\n"),
				"initialized.ts": [
					"class ReadySession {",
					"    constructor() { this.socket = open_socket(); }",
					"    send(message: string): void { this.socket.send(message); }",
					"}",
				].join("\n"),
				"field-comparison.ts": [
					"class ComparisonSession {",
					"    compare(): boolean { return this.socket === null; }",
					"    read(): string { return this.socket; }",
					"}",
				].join("\n"),
				"field-compound.ts": [
					"class Counter {",
					"    set(): void { this.count = 1; }",
					"    add(): void { this.count += 1; }",
					"}",
				].join("\n"),
				"field_comparison.py": [
					"class ComparisonSession:",
					"    def compare(self) -> bool:",
					"        return self.socket == None",
					"    def read(self) -> str:",
					"        return self.socket",
				].join("\n"),
				"field_compound.py": [
					"class Counter:",
					"    def set(self) -> None:",
					"        self.count = 1",
					"    def add(self) -> None:",
					"        self.count += 1",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const temporal = violations.filter((item) => item.rule_id === "temporal-coupling");
		expect({
			hidden_global: violations.filter((item) => item.rule_id === "hidden-global-state").length,
			temporal_detected: temporal.length,
			comparison_fields: temporal.filter((item) => item.file.includes("comparison")).length,
			compound_fields: temporal.filter((item) => item.file.includes("compound")).length,
		}).toEqual({
			hidden_global: 2,
			temporal_detected: 4,
			comparison_fields: 0,
			compound_fields: 2,
		});
	});
});
