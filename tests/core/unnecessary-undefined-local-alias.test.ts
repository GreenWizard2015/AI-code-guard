import { TestFixture } from "tests/core/test-fixture";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint local type property resolution", () => {
	test("resolves required fields through local type aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"local-property-alias.ts": [
					"function candidate(): boolean {",
					"\ttype CandidateParsed = { value: string };",
					'\tconst candidate_parsed: CandidateParsed = { value: "" };',
					"\treturn candidate_parsed.value === undefined;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test("resolves required fields through local interfaces", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"local-property-interface.ts": [
					"function candidate(): boolean {",
					"\tinterface CandidateParsed { value: string; }",
					'\tconst candidate_parsed: CandidateParsed = { value: "" };',
					"\treturn candidate_parsed.value === undefined;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test("resolves required fields through namespace imported interfaces", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"model.ts": "export interface Model { id: string; }",
				"consumer.ts": [
					"import * as Domain from './model';",
					'const model: Domain.Model = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ line: 3 }),
		]);
	});

	test("resolves required fields through star re-exported interfaces", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"model.ts": "export interface Model { id: string; }",
				"barrel.ts": "export * from './model';",
				"consumer.ts": [
					"import { Model } from './barrel';",
					'const model: Model = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ file: expect.stringContaining("consumer.ts"), line: 3 }),
		]);
	});

	test("resolves required fields through project-root compiler aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tsconfig.json": JSON.stringify({
					compilerOptions: { baseUrl: ".", paths: { "@domain/*": ["src/domain/*"] } },
				}),
				"src/domain/model.ts": "export interface Model { id: string; }",
				"consumer.ts": [
					"import { Model } from '@domain/model';",
					'const model: Model = { id: "" };',
					"const invalid = model.id === undefined;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ file: expect.stringContaining("consumer.ts"), line: 3 }),
		]);
	});

	test("resolves required fields through value aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"object-alias.ts": [
					"interface Model { id: string; }",
					'const model: Model = { id: "" };',
					"const alias = model;",
					"const invalid = alias.id === undefined;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test("keeps same parameter names in separate lexical scopes", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
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

		expect(violations.filter((item) => item.rule_id === "unnecessary-undefined-check")).toEqual([
			expect.objectContaining({ line: 7 }),
		]);
	});
});
