import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint class metrics rules", () => {
	test("suggests a class for functions returning dictionary type aliases", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"dictionary-return.ts": [
				"type ProfileData = { name: string; serialize(): string; };",
				"type ProfileAlias = ProfileData;",
				"type ProfileAliasTwo = ProfileAlias;",
				'function build_profile(): ProfileData { return { name: "Ada" }; }',
				'function build_alias(): ProfileAliasTwo { return { name: "Ada" }; }',
				'const build_arrow = (): ProfileAliasTwo => ({ name: "Ada", serialize() { return "Ada"; } });',
				'function build_text(): string { return "Ada"; }',
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "function returns a dictionary type alias",
				line: 4,
				priority: 5,
			}),
		);
		expect(violations.filter((item) => item.message === "function returns a dictionary type alias")).toHaveLength(3);
	});

	test("resolves dictionary aliases nested in namespaces", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"dictionary-return.ts": [
				"namespace Dictionaries {",
				"  export type ProfileData = { name: string; serialize(): string; };",
				"}",
				'function build_profile(): Dictionaries.ProfileData { return { name: "Ada" }; }',
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-dictionary-return")).toHaveLength(1);
	});

	test("resolves dictionary aliases through transparent return containers", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"dictionary-wrapper-return.ts": [
				"type ProfileData = { name: string; serialize(): string; };",
				'function build_profile(): Promise<ProfileData> { return Promise.resolve({ name: "Ada", serialize() { return "Ada"; } }); }',
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-dictionary-return")).toHaveLength(1);
	});

	test("resolves dictionary aliases inside nullable return unions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"dictionary-union-return.ts": [
				"type Profile = { serialize(): string; };",
				"function build_profile(): Profile | undefined { return undefined; }",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-dictionary-return")).toHaveLength(1);
	});

	test("counts constructors as one class method position", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"constructor-count.ts": ["class Service {", "  constructor() {}", "  run() { return 1; }", "}"].join("\n"),
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ message: "class has too many methods (found 3)" })]),
		);
	});

	test("reports metrics for nested TypeScript classes", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-class.ts": ["function candidate(): void {", "  class Nested {}", "  new Nested();", "}"].join("\n"),
		});

		expect({
			nested: violations.find((item) => item.rule_id === "nested-class")?.priority,
			method_count: violations.filter((item) => item.line === 2 && item.rule_id === "class-method-min-count").length,
			state: violations.filter((item) => item.line === 2 && item.rule_id === "stateless-class").length,
			size: violations.filter((item) => item.line === 2 && item.rule_id === "class-min-size").length,
		}).toEqual({ nested: 8, method_count: 0, state: 1, size: 1 });
	});

	test("reports procedural job-title names regardless of class state", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"parser.ts": [
				"class JsonParser {",
				"  private readonly schema: JsonSchema;",
				"  public constructor(schema: JsonSchema) { this.schema = schema; }",
				"  public parse(text: string): string { return this.schema.parse(text); }",
				"}",
				"class JsonDocument {",
				"  private readonly text: string;",
				"  public constructor(text: string) { this.text = text; }",
				"  public value(): string { return this.text; }",
				"}",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'class name describes a job: "JsonParser"',
				priority: 2,
				rule_id: "procedural-class-name",
			}),
		);
		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: 'class name describes a job: "JsonDocument"',
			}),
		);
	});

	test("reports the same procedural name hint for Python regardless of class state", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"parser.py": [
				"class JsonParser:",
				"    def __init__(self, schema):",
				"        self.schema = schema",
				"    def parse(self, text: str) -> str:",
				"        return self.schema.parse(text)",
				"",
				"class JsonDocument:",
				"    def __init__(self, text: str):",
				"        self.text = text",
				"    def value(self) -> str:",
				"        return self.text",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'class name describes a job: "JsonParser"',
				priority: 2,
				rule_id: "procedural-class-name",
			}),
		);
		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: 'class name describes a job: "JsonDocument"',
			}),
		);
	});
});
