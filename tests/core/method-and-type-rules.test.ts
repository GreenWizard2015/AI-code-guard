import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import type { ViolationContract } from "src/reporting_protocols";
import { METHOD_GROUP_SOURCES, METHOD_SOURCES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint method and type rules", () => {
	test.each<{
		name: string;
		files: Record<string, string>;
		expected_counts: Record<string, number>;
		expected_presence: string[];
		absent_presence: string[];
		included_messages: string[];
		excluded_messages: string[];
		expected_locations: { rule_id: string; file_suffix: string }[];
	}>([
		{
			name: "requires explicit Python return, parameter, and field types",
			files: {
				"annotations.py": [
					"def load(value):",
					"    return value",
					"",
					"class Service:",
					"    field = 1",
					"",
					"    def run(self, value):",
					"        return value",
				].join("\n"),
			},
			expected_counts: {
				"explicit-return-type": 2,
				"python-explicit-parameter-type": 2,
				"python-explicit-field-type": 1,
			},
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "requires result types for named TypeScript callables",
			files: {
				"callables.ts": [
					"function load(value: string) { return value; }",
					"const build = (value: string) => value;",
					"const wrapped = (() => value);",
					"const satisfied = (() => value) satisfies () => string;",
					"class Service {",
					"\tpublic run() { return 1; }",
					"\tpublic get value() { return 1; }",
					"}",
					"interface Contract { fetch(): string; missing(); }",
				].join("\n"),
			},
			expected_counts: { "explicit-return-type": 7 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "requires naming long logical chains",
			files: {
				"conditions.ts":
					"function ready(a: boolean, b: boolean, c: boolean, d: boolean): boolean { return a && b && c && d; }",
				"conditions.py": "def ready(a: bool, b: bool, c: bool, d: bool) -> bool:\n    return a and b and c and d",
			},
			expected_counts: { "logical-chain-size": 2 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "reports shared public method naming patterns in both languages",
			files: METHOD_SOURCES,
			expected_counts: {
				"method-get-name": 2,
				"method-set-name": 2,
				"method-process-name": 2,
				"method-and-name": 2,
				"method-long-name": 1,
			},
			expected_presence: [],
			absent_presence: [],
			included_messages: ["public method uses a storage-shaped setter name"],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "does not enforce method contracts in test paths",
			files: {
				"tests/framework-overrides.ts": [
					"class Handler {",
					'\tpublic getKeyRange(): string { return ""; }',
					"\tpublic setUp(): void {}",
					"}",
				].join("\n"),
			},
			expected_counts: { "method-get-name": 0, "method-set-name": 0 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "assigns distinct diagnostics to naming groups",
			files: METHOD_GROUP_SOURCES,
			expected_counts: {},
			expected_presence: [
				"method-get-name",
				"method-find-fetch-lookup-name",
				"method-load-read-open-name",
				"method-calculate-compute-name",
				"method-create-build-generate-name",
				"method-parse-convert-transform-name",
				"method-set-name",
				"method-process-name",
				"method-handle-name",
				"method-execute-perform-do-name",
				"method-and-name",
				"method-long-name",
				"boolean-is-name",
				"boolean-exists-name",
				"boolean-equals-name",
				"boolean-has-can-name",
			],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows construction commands but reports construction-shaped results",
			files: {
				"file_access.ts": [
					"class FileAccess {",
					"\tpublic create_directory(path: string): void {}",
					'\tpublic create_label(): string { return "folder"; }',
					"}",
				].join("\n"),
			},
			expected_counts: { "method-create-build-generate-name": 1 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows six CamelCase words and reports seven",
			files: {
				"camel-case.ts": [
					"class Catalog {",
					'\tpublic oneTwoThreeFourFiveSix(): string { return ""; }',
					'\tpublic oneTwoThreeFourFiveSixSeven(): string { return ""; }',
					'\tpublic TestForAcronymsUNExample(): string { return ""; }',
					'\tpublic TestForAcronymsUNExampleWithOne(): string { return ""; }',
					"}",
				].join("\n"),
			},
			expected_counts: { "method-long-name": 2 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "rejects TypeScript static fields without rejecting static methods",
			files: {
				"static-fields.ts": [
					"class SessionStore {",
					"\tprivate static readonly sessions = new Map<string, string>();",
					"\tpublic static create(): SessionStore { return new SessionStore(); }",
					"\tpublic static get instance(): SessionStore { return new SessionStore(); }",
					"}",
				].join("\n"),
			},
			expected_counts: { "typescript-static-field": 1, "typescript-static-method": 2 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
		{
			name: "allows TypeScript expect only inside test callbacks",
			files: {
				"src/production.ts": ["assert(value);", "expect(value).toBe(true);", "assert.equal(value, true);"].join("\n"),
				"tests/assertions.ts": [
					"expect(value).toBe(true);",
					'test("value", () => { expect(value).toBe(true); });',
				].join("\n"),
			},
			expected_counts: { "assertion-outside-test": 1 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [{ rule_id: "assertion-outside-test", file_suffix: "tests/assertions.ts" }],
		},
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
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				files,
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			);
			const rule_ids = violations.map((item) => item.rule_id);
			const actual_counts = Object.fromEntries(
				Object.entries(expected_counts).map(([rule_id]) => [
					rule_id,
					violations.filter((item) => item.rule_id === rule_id).length,
				]),
			);
			const actual_locations = expected_locations.map(({ rule_id, file_suffix }) =>
				violations.some((item) => {
					if (item.rule_id !== rule_id) {
						return false;
					}
					return item.file.endsWith(file_suffix);
				}),
			);

			expect({
				counts: actual_counts,
				present: expected_presence.map((rule_id) => rule_ids.includes(rule_id)),
				absent: absent_presence.map((rule_id) => !rule_ids.includes(rule_id)),
				messages: included_messages.map((text) => violations.some((item) => item.message.includes(text))),
				excluded_messages: excluded_messages.map((text) => violations.every((item) => !item.message.includes(text))),
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

	test("reports mixed arithmetic precedence in production expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"arithmetic.ts": "function total(a: number, b: number, c: number): number { return a + b * c; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "mixed-arithmetic-precedence")).toHaveLength(1);
	});

	test("accepts an annotated Python slot initialized in the constructor", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"slot_owner.py": [
					"class SlotOwner:",
					"    __slots__ = ('value',)",
					"    def __init__(self) -> None:",
					"        self.value: int = 1",
					"    def read(self) -> int:",
					"        return self.value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "python-explicit-field-type")).toEqual([]);
	});
});
