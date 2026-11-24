import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint local type property resolution", () => {
	test("reports required-field undefined comparisons in direct and parenthesized forms", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"required-parts.ts": [
					"type PathParts = { first_segment: string; last_segment: string };",
					"function has_missing_part(parts: PathParts): boolean {",
					"  return parts.first_segment === undefined || parts.last_segment === undefined;",
					"}",
				].join("\n"),
				"parenthesized-property.ts": [
					"type Parsed = { attribute_accesses: string[] };",
					"function has_attributes(parsed: Parsed): boolean {",
					"\treturn (parsed.attribute_accesses) === undefined;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const undefined_checks = violations.filter((item) => item.rule_id() === "unnecessary-undefined-check");
		expect(undefined_checks.map((item) => `${item.file()}:${item.line()}`).sort()).toEqual([
			"parenthesized-property.ts:3",
			"required-parts.ts:3",
			"required-parts.ts:3",
		]);
	});

	test("resolves local aliases and keeps same-named fields scoped", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"local-property-alias.ts": [
					"function candidate(): boolean {",
					"\ttype CandidateParsed = { value: string };",
					'\tconst candidate_parsed: CandidateParsed = { value: "" };',
					"\treturn candidate_parsed.value === undefined;",
					"}",
				].join("\n"),
				"local-property-interface.ts": [
					"function candidate(): boolean {",
					"\tinterface CandidateParsed { value: string; }",
					'\tconst candidate_parsed: CandidateParsed = { value: "" };',
					"\treturn candidate_parsed.value === undefined;",
					"}",
				].join("\n"),
				"object-alias.ts": [
					"interface Model { id: string; }",
					'const model: Model = { id: "" };',
					"const alias = model;",
					"const invalid = alias.id === undefined;",
				].join("\n"),
				"scoped-property-types.ts": [
					"type OptionalModel = { value?: string };",
					"type RequiredModel = { value: string };",
					"function optional(model: OptionalModel): boolean {",
					"\treturn model.value === undefined;",
					"}",
					"function required(model: RequiredModel): boolean {",
					"\treturn model.value === undefined;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const undefined_checks = violations.filter((item) => item.rule_id() === "unnecessary-undefined-check");
		expect(undefined_checks.map((item) => `${item.file()}:${item.line()}`).sort()).toEqual([
			"local-property-alias.ts:4",
			"local-property-interface.ts:4",
			"object-alias.ts:4",
			"scoped-property-types.ts:7",
		]);
	});

	test("resolves required fields through namespace, re-export, and compiler aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"namespace-model.ts": "export interface NamespaceModel { id: string; }",
				"namespace-consumer.ts": [
					"import * as Domain from './namespace-model';",
					'const model: Domain.NamespaceModel = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
				"star-model.ts": "export interface StarModel { id: string; }",
				"star-barrel.ts": "export * from './star-model';",
				"star-consumer.ts": [
					"import { StarModel } from './star-barrel';",
					'const model: StarModel = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
				"tsconfig.json": JSON.stringify({
					compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } },
				}),
				"src/domain/compiler-model.ts": "export interface CompilerModel { id: string; }",
				"compiler-consumer.ts": [
					"import { CompilerModel } from '@domain/compiler-model';",
					'const model: CompilerModel = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const undefined_checks = violations.filter((item) => item.rule_id() === "unnecessary-undefined-check");
		expect({
			count: undefined_checks.length,
			namespace: undefined_checks
				.filter((item) => item.file().endsWith("namespace-consumer.ts"))
				.map((item) => item.line()),
			star: undefined_checks.filter((item) => item.file().endsWith("star-consumer.ts")).map((item) => item.line()),
			compiler_alias: undefined_checks
				.filter((item) => item.file().endsWith("compiler-consumer.ts"))
				.map((item) => item.line()),
		}).toEqual({ count: 3, namespace: [3], star: [3], compiler_alias: [3] });
	});
});
