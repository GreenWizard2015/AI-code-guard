import "src/linting/composition/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import "src/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptReferenceIdentity } from "src/parser/references/identity/references/type_script_reference_identity";
import { TestFixture } from "tests/core/test-fixture";
import { TypeScriptReferenceIdentityFixture } from "tests/type_script_reference/type_script_reference_identity_fixture";

describe("callable ownership lexical identity", () => {
	const test_fixture = new TestFixture();
	const identity_fixture = new TypeScriptReferenceIdentityFixture();

	test("does not inherit an outer instance through an unknown local", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"const client = new First();",
					"function get_client(): any { return undefined; }",
					"function run(): void { const client = get_client(); client.execute(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts", "second.ts"]);
	});

	test("does not inherit an outer instance through an unknown destructured binding", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"const client = new First();",
					"function run(value: { client: any }): void { const { client } = value; client.execute(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts", "second.ts"]);
	});

	test("prioritizes constructor ownership over a conflicting variable annotation", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"const client: First = new Second();",
					"client.execute();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts"]);
	});

	test("prioritizes constructor ownership over a conflicting parameter annotation", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"function use(client: First = new Second()): number { return client.execute(); }",
					"use();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts"]);
	});

	test("keeps repeated local instance names tied to their lexical scope", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first'; import { Service as Second } from './second';",
					"function first_call(): number { const client = new First(); return client.execute(); }",
					"function second_call(): void { const client = new Second(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("keeps repeated block instance names tied to their lexical scope", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first'; import { Service as Second } from './second';",
					"function run(): void { { const client = new First(); client.execute(); } { const client = new Second(); } }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("keeps an outer instance after a catch binding ends", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"function run(): number {",
					"  const client = new First();",
					"  try { throw 0; } catch (client) { client; }",
					"  return client.execute();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("keeps the declaration file through a local instance alias", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"const original = new First(); const copy = original; copy.execute();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("keeps repeated var bindings tied to the declaration before the call", () => {
		const root = "/virtual/repeated-var-identity";
		const source_files = identity_fixture.source_files(root, {
			"first.ts": "export class Service { public execute(): number { return 1; } }",
			"second.ts": "export class Service { public execute(): number { return 2; } }",
			"consumer.ts": [
				"import { Service as First } from './first'; import { Service as Second } from './second';",
				"function use(): number { var client = new First(); client.execute(); var client = new Second(); return client.execute(); }",
			].join("\n"),
		});
		const consumer = identity_fixture.required_source_file(source_files, `${root}/consumer.ts`);
		const accesses = identity_fixture.property_accesses(consumer, "execute");
		const identity = new TypeScriptReferenceIdentity(
			consumer,
			root,
			source_files,
			new InMemoryProjectSourceIO(new Map()),
		);
		const resolutions = accesses.map((candidate) => identity.method_reference(candidate, "Service"));
		const resolution = resolutions.at(0);

		expect({ access_count: accesses.length, resolution }).toEqual({
			access_count: 2,
			resolution: { name: "execute", target_file: "first.ts" },
		});
	});

	test("updates a block-scoped receiver after reassignment", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"function run(): number { let client = new First(); client = new Second(); return client.execute(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts"]);
	});

	test("copies the complete receiver identity from an outer binding", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"const original = new First();",
					"function run(): number { let client = new Second(); client = original; return client.execute(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("updates an outer receiver from a nested function", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"let client = new First();",
					"function run(): number { client = new Second(); return client.execute(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts"]);
	});
});
