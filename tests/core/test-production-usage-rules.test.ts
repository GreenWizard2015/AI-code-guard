import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("production usage requirements for tests", () => {
	test("requires direct use of imported production behavior in every test", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"src/message_parser.ts": [
					"export class MessageParser {",
					"  public parse(text: string): string { return text; }",
					"}",
				].join("\n"),
				"src/message_parser.py": [
					"class MessageParser:",
					"    def parse(self, text: str) -> str:",
					"        return text",
				].join("\n"),
				"tests/support/message_parser.ts": [
					"export class MessageParser {",
					"  public parse(text: string): string { return text; }",
					"}",
				].join("\n"),
				"tests/support/message_parser.test.ts": [
					"import { MessageParser } from './message_parser';",
					"describe('MessageParser', () => {",
					"  test('uses only a test helper', () => {",
					"    expect(new MessageParser().parse('value')).toBe('value');",
					"  });",
					"});",
				].join("\n"),
				"tests/src/message_parser.test.ts": [
					"import { MessageParser } from 'src/message_parser';",
					"describe('MessageParser', () => {",
					"  test('uses production parser', () => {",
					"    const result = new MessageParser().parse('value');",
					"    expect(result).toBe('value');",
					"  });",
					"  test('does not use production parser', () => {",
					"    expect(true).toBe(true);",
					"  });",
					"});",
				].join("\n"),
				"tests/src/message_parser_helper.test.ts": [
					"import { MessageParser } from 'src/message_parser';",
					"function create_fixture(): MessageParser { return new MessageParser(); }",
					"describe('MessageParser', () => {",
					"  test('does not hide production construction in a helper', () => {",
					"    const parser = create_fixture();",
					"    expect(parser.parse('value')).toBe('value');",
					"  });",
					"});",
				].join("\n"),
				"tests/src/message_parser_setup.test.ts": [
					"import { MessageParser } from 'src/message_parser';",
					"let parser: MessageParser;",
					"beforeEach(() => { parser = new MessageParser(); });",
					"describe('MessageParser', () => {",
					"  test('does not hide production construction in setup', () => {",
					"    expect(parser.parse('value')).toBe('value');",
					"  });",
					"});",
				].join("\n"),
				"tests/src/test_message_parser.py": [
					"import unittest",
					"from src.message_parser import MessageParser",
					"class TestMessageParser(unittest.TestCase):",
					"    def test_parses(self) -> None:",
					"        result = MessageParser().parse('value')",
					"        self.assertEqual(result, 'value')",
					"    def test_other_behavior(self) -> None:",
					"        self.assertTrue(True)",
				].join("\n"),
				"tests/src/test_message_parser_helper.py": [
					"import unittest",
					"from src.message_parser import MessageParser",
					"def create_fixture() -> MessageParser:",
					"    return MessageParser()",
					"class TestMessageParser(unittest.TestCase):",
					"    def test_parses(self) -> None:",
					"        parser = create_fixture()",
					"        self.assertEqual(parser.parse('value'), 'value')",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const usage_violations = violations.filter((item) => item.rule_id === "test-production-usage");
		expect(usage_violations).toHaveLength(6);
		expect(usage_violations.map((item) => item.file)).toEqual([
			"tests/src/message_parser.test.ts",
			"tests/src/message_parser_helper.test.ts",
			"tests/src/message_parser_setup.test.ts",
			"tests/src/test_message_parser.py",
			"tests/src/test_message_parser_helper.py",
			"tests/support/message_parser.test.ts",
		]);
	});

	test("accepts direct behavioral assertions in both supported test languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"src/message_parser.ts": [
					"export class MessageParser {",
					"  public parse(text: string): string { return text.trim(); }",
					"}",
				].join("\n"),
				"src/message_parser.py": [
					"class MessageParser:",
					"    def parse(self, text: str) -> str:",
					"        return text.strip()",
				].join("\n"),
				"tests/src/message_parser.test.ts": [
					"import { MessageParser } from 'src/message_parser';",
					"test('trims input', () => {",
					"  expect(new MessageParser().parse(' value ')).toBe('value');",
					"});",
				].join("\n"),
				"tests/src/test_message_parser.py": [
					"import unittest",
					"from src.message_parser import MessageParser",
					"class TestMessageParser(unittest.TestCase):",
					"    def test_trims_input(self) -> None:",
					"        parser = MessageParser()",
					"        self.assertEqual(parser.parse(' value '), 'value')",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-production-usage")).toHaveLength(0);
	});

	test("resolves a production class through a configured nested source alias", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tsconfig.json": JSON.stringify({
					compilerOptions: {
						baseUrl: ".",
						paths: { "src/scripts/webpage/*": ["scripts/webpage/src/*"] },
					},
				}),
				"scripts/webpage/src/page-snapshot-reader.ts": [
					"export class PageSnapshotReader {",
					"  public loading_markers(): boolean { return true; }",
					"}",
				].join("\n"),
				"tests/scripts/webpage/page-snapshot-reader.test.ts": [
					"import { PageSnapshotReader } from 'src/scripts/webpage/page-snapshot-reader';",
					"test('reads loading markers', () => {",
					"  const reader = new PageSnapshotReader();",
					"  expect(reader.loading_markers()).toBe(true);",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "test-production-usage")).toEqual([]);
	});
});
