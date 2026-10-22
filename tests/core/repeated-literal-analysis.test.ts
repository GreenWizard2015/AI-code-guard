import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("project-wide repeated literal analysis", () => {
	test("does not treat Python __all__ export names as repeated string literals", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tools/webmcp_project/__init__.py": [
					"__all__ = [",
					'    "BrowserBridge",',
					'    "ProjectBrowserBridge",',
					'    "ProjectConfig",',
					'    "ProjectSettings",',
					'    "Repository",',
					'    "UpstreamGatewayDependencies",',
					'    "UserscriptsPlugin",',
					"]",
				].join("\n"),
				"tools/webmcp_project/browser_bridge/__init__.py": [
					"__all__ = [",
					'    "BrowserBridge",',
					'    "BrowserBridgeCallStore",',
					'    "BrowserBridgeTransport",',
					'    "ProjectBrowserBridge",',
					'    "UpstreamGatewayDependencies",',
					'    "WebMcpProjectTasks",',
					"]",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const literal_diagnostics = violations.filter(
			(item) => item.rule_id === "repeated-literal" || item.rule_id === "literal-constant-reuse",
		);

		expect(literal_diagnostics).toEqual([]);
	});

	test("excludes test literals from repeated-literal and constant-reuse diagnostics", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"messages.ts": 'export const SHARED_MESSAGE = "production response unavailable";',
				"messages.py": 'SHARED_MESSAGE = "production response unavailable"',
				"consumer.ts": [
					"export class MessageConsumer {",
					'\tpublic message(): string { return "production response unavailable"; }',
					"}",
				].join("\n"),
				"consumer.py": [
					"class MessageConsumer:",
					'    def message(self) -> str: return "production response unavailable"',
				].join("\n"),
				"tests/messages.test.ts": [
					"describe('messages', () => {",
					"\ttest('uses fixtures', () => {",
					'\t\tconst first = "production response unavailable";',
					'\t\tconst second = "production response unavailable";',
					"\t\texpect(first).toBe(second);",
					"\t});",
					"});",
				].join("\n"),
				"tests/test_messages.py": [
					"import unittest",
					"class TestMessages(unittest.TestCase):",
					"    def test_uses_fixtures(self) -> None:",
					'        first = "production response unavailable"',
					'        second = "production response unavailable"',
					"        self.assertEqual(first, second)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const literal_diagnostics = violations.filter(
			(item) => item.rule_id === "repeated-literal" || item.rule_id === "literal-constant-reuse",
		);
		const test_file_diagnostics = literal_diagnostics.filter((item) => item.file.startsWith("tests/"));
		const production_reuse_files = literal_diagnostics
			.filter((item) => item.rule_id === "literal-constant-reuse")
			.map((item) => item.file)
			.sort();

		expect({ test_file_diagnostics, production_reuse_files }).toEqual({
			test_file_diagnostics: [],
			production_reuse_files: ["consumer.py", "consumer.ts"],
		});
	});

	test("reports every repeated occurrence and reuses matching constants", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"occurrences.ts": [
					"function report(): void {",
					'  write({ payload: ["remote connection is not available"] });',
					'  log({ payload: { message: "remote connection is not available" } });',
					'  throw new Error(["remote connection is not available"][0]);',
					"}",
				].join("\n"),
				"occurrences.py": [
					"def report() -> None:",
					'    write({"payload": ["remote connection is not available"]})',
					'    log({"payload": {"message": "remote connection is not available"}})',
					'    raise RuntimeError(["remote connection is not available"][0])',
				].join("\n"),
				"constants.ts": 'export const CONNECTION_MESSAGE = "connection is unavailable";',
				"messages.ts": ["function report(): void {", '  write("connection is unavailable");', "}"].join("\n"),
				"constants.py": 'CONNECTION_MESSAGE = "connection is unavailable"',
				"messages.py": ["def report() -> None:", '    write("connection is unavailable")'].join("\n"),
				"requested.ts": [
					"function report(): void {",
					'  write("service response is unavailable");',
					'  log("service response is unavailable");',
					"}",
				].join("\n"),
				"requested.py": [
					"def report() -> None:",
					'    write("service response is unavailable")',
					'    log("service response is unavailable")',
				].join("\n"),
				"documented.ts": [
					"function report(): void {",
					'  "project data is not available";',
					"  if (true) {",
					'    "project data is not available";',
					"  }",
					'  write("project data is not available");',
					'  log("project data is not available");',
					'  throw new Error("project data is not available");',
					"}",
				].join("\n"),
				"documented.py": [
					"def report() -> None:",
					'    """project data is not available"""',
					"    if True:",
					'        "project data is not available"',
					'    write("project data is not available")',
					'    log("project data is not available")',
					'    raise RuntimeError("project data is not available")',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _literal occurrence counts_. **/
		const repeated_in = (file: string): number =>
			violations.filter((item) => item.rule_id === "repeated-literal" && item.file === file).length;
		const constant_uses = violations.filter((item) => item.rule_id === "literal-constant-reuse");
		expect({
			occurrences_ts: repeated_in("occurrences.ts"),
			occurrences_py: repeated_in("occurrences.py"),
			requested_ts: repeated_in("requested.ts"),
			requested_py: repeated_in("requested.py"),
			documented_ts: repeated_in("documented.ts"),
			documented_py: repeated_in("documented.py"),
			constant_targets: constant_uses.map((item) => item.file).sort(),
		}).toEqual({
			occurrences_ts: 3,
			occurrences_py: 3,
			requested_ts: 2,
			requested_py: 2,
			documented_ts: 5,
			documented_py: 3,
			constant_targets: ["messages.py", "messages.ts"],
		});
	});

	test("keeps nested production repetition while excluding test values from reuse", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"local-constant.ts": [
					"export function first(): string {",
					'  const PRIVATE_MESSAGE = "private local response is missing";',
					"  return PRIVATE_MESSAGE;",
					"}",
					"export function second(): string {",
					'  return "private local response is missing";',
					"}",
				].join("\n"),
				"limited.ts": [
					"function report(): void {",
					'  write("short");',
					'  log("short");',
					'  throw new Error("short");',
					"}",
					"function nested(): void {",
					"  function child(): void {",
					'    write("nested message");',
					'    log("nested message");',
					"  }",
					"}",
				].join("\n"),
				"enum-values.ts": 'enum DeclarationKind { Function = "function", Contract = "contract" }',
				"tests/messages.test.ts": [
					"describe('messages', () => {",
					"  test('repeats', () => {",
					'    write("test message");',
					'    log("test message");',
					'    throw new Error("test message");',
					"    expect(true).toBe(true);",
					"  });",
					"});",
				].join("\n"),
				"tests/test_messages.py": [
					"import unittest",
					"class TestMessages(unittest.TestCase):",
					"    def test_repeats(self) -> None:",
					'        write("test message")',
					'        log("test message")',
					'        raise RuntimeError("test message")',
					"        self.assertTrue(True)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const repeated_locations = violations
			.filter((item) => item.rule_id === "repeated-literal")
			.map((item) => [item.file, item.line]);
		const constant_reuse_count = violations.filter((item) => item.rule_id === "literal-constant-reuse").length;
		const enum_file_violations = violations.filter((item) => item.file === "enum-values.ts");
		const enum_value_count = enum_file_violations.filter((item) => item.rule_id.includes("literal")).length;
		expect({ repeated_locations, constant_reuse_count, enum_value_count }).toEqual({
			repeated_locations: [
				["limited.ts", 8],
				["limited.ts", 9],
				["local-constant.ts", 2],
				["local-constant.ts", 6],
			],
			constant_reuse_count: 0,
			enum_value_count: 0,
		});
	});
});
