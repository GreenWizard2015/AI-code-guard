import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("callable feature detection", () => {
	test("reports callable checks through aliases, computed members, and static values", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"property-alias.ts": [
					"const service_run = service.run;",
					"const service_run_alias = service_run;",
					'if (typeof service.run === "function") { return; }',
					'if (typeof service_run_alias === "function") { return; }',
				].join("\n"),
				"computed-member.ts": [
					"const member_name = 'run';",
					"if (typeof service['run'] === 'function') { return; }",
					"if (typeof service[member_name] === 'function') { return; }",
					"if (typeof (service.run) === 'function') { return; }",
					"const function_type = 'function'; if (typeof service.run === function_type) { return; }",
				].join("\n"),
				"escaped-kind.ts": ['const kind = "funct\\u0069on";', "if (typeof service.run === kind) { return; }"].join(
					"\n",
				),
				"reassigned-values.ts": [
					"let items = ['first'];",
					"items = ['second'];",
					"items = ['third'];",
					'if (typeof service.run === "function") { return; }',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);
		const counts = new Map<string, number>();
		for (const violation of execution.report.violations.filter(
			(item) => item.rule_id === "callable-feature-detection",
		)) {
			const file_name = violation.file.split("/").at(-1);
			let name = "";
			if (file_name !== undefined) {
				name = file_name;
			}
			let count = counts.get(name);
			if (count === undefined) {
				count = 0;
			}
			counts.set(name, count + 1);
		}

		expect(Object.fromEntries(counts)).toEqual({
			"property-alias.ts": 2,
			"computed-member.ts": 4,
			"escaped-kind.ts": 1,
			"reassigned-values.ts": 1,
		});
	});

	test("reports parenthesized, negated, wrapped, and destructured callable checks", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"parenthesized.ts": [
					'if (typeof service.run === "function") { return; }',
					'if ((typeof service.run === "function")) { return; }',
				].join("\n"),
				"negated.ts": [
					'if (typeof service.run === "function") { return; }',
					'if (!(typeof service.run === "function")) { return; }',
				].join("\n"),
				"boolean-wrapped.ts": [
					'if (typeof service.run === "function") { return; }',
					'if (Boolean(typeof service.run === "function")) { return; }',
				].join("\n"),
				"reversed.ts": ["const service_run = service.run;", 'if ("function" === typeof service_run) { return; }'].join(
					"\n",
				),
				"object-destructuring.ts": [
					"const { run: service_run } = service;",
					'if (typeof service_run === "function") { return; }',
				].join("\n"),
				"array-destructuring.ts": [
					"const [service_run] = [service.run];",
					'if (typeof service_run === "function") { return; }',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);
		const counts = new Map<string, number>();
		for (const violation of execution.report.violations.filter(
			(item) => item.rule_id === "callable-feature-detection",
		)) {
			const file_name = violation.file.split("/").at(-1);
			let name = "";
			if (file_name !== undefined) {
				name = file_name;
			}
			let count = counts.get(name);
			if (count === undefined) {
				count = 0;
			}
			counts.set(name, count + 1);
		}

		expect(Object.fromEntries(counts)).toEqual({
			"parenthesized.ts": 2,
			"negated.ts": 2,
			"boolean-wrapped.ts": 2,
			"reversed.ts": 1,
			"object-destructuring.ts": 1,
			"array-destructuring.ts": 1,
		});
	});

	test("does not certify ambiguous aliases, shadowed bindings, or primitive checks", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"ambiguous.ts": [
					"const comma_kind = ('function', 'number');",
					"const conditional_kind = enabled ? 'function' : 'number';",
					"if (typeof service.run === comma_kind) { return; }",
					"if (typeof service.run === conditional_kind) { return; }",
				].join("\n"),
				"shadowed.ts": [
					"const kind = 'function';",
					"function check(): void {",
					"  const kind = 'number';",
					"  if (typeof service.run === kind) { return; }",
					"}",
				].join("\n"),
				"primitive.ts": 'const count = 1; if (typeof count === "number") { return; }',
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "callable-feature-detection")).toHaveLength(0);
	});
});
