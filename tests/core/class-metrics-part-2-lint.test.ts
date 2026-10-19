import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("additional class metrics rules", () => {
	test("detects TypeScript dictionary returns, nested classes, and procedural names", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"dictionary.ts": [
					"type ProfileData = { name: string; serialize(): string; };",
					"type ProfileAlias = ProfileData; type ProfileAliasTwo = ProfileAlias;",
					'function build_profile(): ProfileData { return { name: "Ada" }; }',
					'function build_alias(): ProfileAliasTwo { return { name: "Ada" }; }',
					'const build_arrow = (): ProfileAliasTwo => ({ name: "Ada", serialize() { return "Ada"; } });',
					'function build_text(): string { return "Ada"; }',
					"namespace Dictionaries { export type NestedProfile = { name: string; serialize(): string; }; }",
					'function build_nested(): Dictionaries.NestedProfile { return { name: "Ada" }; }',
					'function build_wrapped(): Promise<ProfileData> { return Promise.resolve({ name: "Ada", serialize() { return "Ada"; } }); }',
					"type NullableProfile = { serialize(): string; }; function build_nullable(): NullableProfile | undefined { return undefined; }",
					"class Counted { constructor() {} run() { return 1; } }",
					"function outer(): void { class Nested {} new Nested(); }",
					"class JsonParser { private schema: JsonSchema; constructor(schema: JsonSchema) { this.schema = schema; } parse(text: string): string { return this.schema.parse(text); } }",
					"class JsonDocument { private text: string; constructor(text: string) { this.text = text; } value(): string { return this.text; } }",
					"class TypeScriptReferenceHelpers {} class JsonParsers {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			dictionary_returns: violations.filter((item) => item.rule_id === "typescript-dictionary-return").length,
			nested_classes: violations.filter((item) => item.rule_id === "nested-class").length,
			procedural_names: violations
				.filter((item) => item.rule_id === "procedural-class-name")
				.map((item) => item.message),
			json_document: violations.filter((item) => item.message === 'class name describes a job: "JsonDocument"').length,
		}).toEqual({
			dictionary_returns: 6,
			nested_classes: 1,
			procedural_names: expect.arrayContaining([
				'class name describes a job: "JsonParser"',
				'class name describes a job: "TypeScriptReferenceHelpers"',
				'class name describes a job: "JsonParsers"',
			]),
			json_document: 0,
		});
	});

	test("applies procedural class-name metrics consistently to Python", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"names.py": [
					"class JsonParser:",
					"    def __init__(self, schema):",
					"        self.schema = schema",
					"    def parse(self, text: str) -> str:",
					"        return self.schema.parse(text)",
					"class JsonDocument:",
					"    def __init__(self, text: str):",
					"        self.text = text",
					"    def value(self) -> str:",
					"        return self.text",
					"class JsonValidators: pass",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			procedural_names: violations
				.filter((item) => item.rule_id === "procedural-class-name")
				.map((item) => item.message),
			json_document: violations.filter((item) => item.message === 'class name describes a job: "JsonDocument"').length,
		}).toEqual({
			procedural_names: expect.arrayContaining([
				'class name describes a job: "JsonParser"',
				'class name describes a job: "JsonValidators"',
			]),
			json_document: 0,
		});
	});
});
