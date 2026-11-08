import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { ViolationContract } from "src/reporting_protocols";
import { METHOD_GROUP_SOURCES, METHOD_SOURCES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint method and type rules", () => {
	test.each([
		{
			name: "matches command prefixes only at a word boundary",
			files: {
				"metadata.py": [
					"class Metadata:",
					"    def do_work(self) -> None:",
					"        pass",
					"    def docstring_locations(self) -> list[str]:",
					"        return []",
				].join("\n"),
				"metadata.ts": [
					"class Metadata {",
					"\tpublic doWork(): void {}",
					"\tpublic docstringLocations(): string[] { return []; }",
					"}",
				].join("\n"),
			},
			expected_counts: { "method-execute-perform-do-name": 2 },
			expected_presence: [],
			absent_presence: [],
			included_messages: [],
			excluded_messages: [],
			expected_locations: [],
		},
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
			name: "allows a registry to build a source-specific result",
			files: {
				"source_registry.ts": [
					"class SourceRegistry {",
					"\tpublic build(source: string): string { return source; }",
					"}",
				].join("\n"),
				"source_registry.py": [
					"class SourceRegistry:",
					"    def build(self, source: str) -> str:",
					"        return source",
				].join("\n"),
			},
			expected_counts: { "method-create-build-generate-name": 0 },
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
			name: "reports arithmetic precedence and accepts an annotated Python slot",
			files: {
				"arithmetic.ts": "function total(a: number, b: number, c: number): number { return a + b * c; }",
				"slot_owner.py": [
					"class SlotOwner:",
					"    __slots__ = ('value',)",
					"    def __init__(self) -> None:",
					"        self.value: int = 1",
					"    def read(self) -> int:",
					"        return self.value",
				].join("\n"),
			},
			expected_counts: { "mixed-arithmetic-precedence": 1, "python-explicit-field-type": 0 },
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
