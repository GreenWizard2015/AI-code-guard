import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint additional method and type rule cases", () => {
	test.each([
		{
			name: "allows Python assertions only inside test functions",
			files: {
				"production.py":
					"def validate(value: bool) -> None:\n    assert value\n\nclass Validator:\n    def validate(self, value: bool) -> None:\n        self.assertEqual(value, True)",
				"tests/assertions.py": "assert module_value",
				"tests/assertions_test.py": [
					"import unittest",
					"",
					"assert module_value",
					"",
					"class TestAssertions(unittest.TestCase):",
					"    def test_value(self):",
					"        assert value",
					"        self.assertEqual(value, True)",
				].join("\n"),
			},
			expected_counts: { "assertion-outside-test": 2 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [
				{ rule_id: "assertion-outside-test", file_suffix: "tests/assertions_test.py" },
				{ rule_id: "assertion-outside-test", file_suffix: "tests/assertions.py" },
			],
		},
		{
			name: "rejects in checks for values that are not typed collections",
			files: {
				"map-in.ts": [
					"const has_key = key in notMap;",
					"if (key in notMap) { return; }",
					"if ((key in notMap)) { return; }",
					"if (!(key in notMap)) { return; }",
					"if (Boolean(key in notMap)) { return; }",
					"if (has_key) { return; }",
					"const [destructured_has_key] = [key in notMap];",
					"if (destructured_has_key) { return; }",
					"const [spread_destructured_has_key] = [...[key in notMap]];",
					"if (spread_destructured_has_key) { return; }",
					"const { object_spread_has_key } = { ...{ object_spread_has_key: key in notMap } };",
					"if (object_spread_has_key) { return; }",
					"const object_alias = { object_alias_has_key: key in notMap };",
					"const { object_alias_has_key } = { ...object_alias };",
					"if (object_alias_has_key) { return; }",
				].join("\n"),
			},
			expected_counts: { "typescript-in-operator": 18 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows in checks only for explicitly typed collections",
			files: {
				"collection-in.ts": ["const values: Map<string, string> = new Map();", "if (key in values) { return; }"].join(
					"\n",
				),
			},
			expected_counts: { "typescript-in-operator": 0 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "does not treat a shadowed collection type name as a built-in",
			files: {
				"shadowed-map-in.ts": [
					"type Map = Record<string, string>;",
					"const options: Map = { name: 'Ada' };",
					"if ('name' in options) { console.log(options.name); }",
				].join("\n"),
				"shadowed-map-constructor.ts": ["class Map {}", "if ('name' in new Map()) { console.log('found'); }"].join(
					"\n",
				),
			},
			expected_counts: { "typescript-in-operator": 4 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows data-only object literals under the fake-object rule",
			files: {
				"payload.ts": ["const payload = {", '\ttext: "value",', "\tcount: 1,", "};"].join("\n"),
			},
			expected_counts: { "typescript-fake-object": 0 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows callback context objects passed to constructors",
			files: {
				"process.ts": [
					"interface ProcessContext { settle: (value: string) => void; }",
					"",
					"class ProcessState {",
					"	public constructor(context: ProcessContext) {}",
					"}",
					"new ProcessState({ settle: (value) => { void value; } });",
				].join("\n"),
			},
			expected_counts: { "typescript-fake-object": 0 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "rejects dynamic own-property checks",
			files: {
				"property-check.ts": "if (Object.prototype.hasOwnProperty.call(value, key)) { return; }",
			},
			expected_counts: { "typescript-dynamic-runtime-usage": 1 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows non-callable serializer payloads to return object literals",
			files: {
				"contracts.ts": "export interface Payload { text: string; }",
				"serializer.ts": [
					"class Serializer {",
					'\tprivate readonly text: string = "value";',
					"\tpublic to_json(): Payload { return { text: this.text }; }",
					"\tpublic to_response(): Payload { return { text: this.text }; }",
					"}",
				].join("\n"),
			},
			expected_counts: { "typescript-object-literal-return": 0 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
	])(
		"$name",
		({
			files,
			expected_counts,
			expected_presence,
			absent_presence,
			included_messages,
			excluded_messages,
			expected_locations,
		}) => {
			const fixture = new TestFixture();
			const violations: ViolationContract[] = fixture.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				files,
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			const rule_ids = violations.map((item) => item.rule_id());
			const actual_counts = Object.fromEntries(
				Object.entries(expected_counts).map(([rule_id]) => [
					rule_id,
					violations.filter((item) => item.rule_id() === rule_id).length,
				]),
			);
			const actual_locations = expected_locations.map(({ rule_id, file_suffix }) =>
				violations.some((item) => {
					if (item.rule_id() !== rule_id) {
						return false;
					}
					return item.file().endsWith(file_suffix);
				}),
			);

			expect({
				counts: actual_counts,
				present: expected_presence.map((rule_id) => rule_ids.includes(rule_id)),
				absent: absent_presence.map((rule_id) => !rule_ids.includes(rule_id)),
				messages: included_messages.map((text) => violations.some((item) => item.message().includes(text))),
				excluded_messages: excluded_messages.map((text) => violations.every((item) => !item.message().includes(text))),
				locations: actual_locations,
			}).toEqual({
				counts: expected_counts,
				present: expected_presence.map(() => true),
				absent: absent_presence.map(() => true),
				messages: included_messages.map(() => true),
				excluded_messages: excluded_messages.map(() => true),
				locations: expected_locations.map(() => true),
			});
		},
	);
});
