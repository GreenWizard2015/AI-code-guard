import "src/linting/orchestration/runtime/global-analysis/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptReferenceIdentity } from "src/parser/references/identity/references/type_script_reference_identity";
import { TestFixture } from "tests/core/test-fixture";
import { TypeScriptReferenceIdentityFixture } from "tests/type_script_reference/type_script_reference_identity_fixture";
import { EmptySourceText } from "src/io/empty_source_text";

describe("callable ownership identity", () => {
	const test_fixture = new TestFixture();
	const identity_fixture = new TypeScriptReferenceIdentityFixture();

	test("does not let test-only base declarations change production inheritance", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": ["export class ProductionService extends FrameworkBase {", "  run() { return 1; }", "}"].join(
					"\n",
				),
				"tests/framework-base.ts": "export class FrameworkBase {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "ProductionService.run"'))).toBe(false);
	});

	test("does not let unrelated production classes resolve a same-named base", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": "export class ProductionService extends FrameworkBase { run() { return 1; } }",
				"unrelated.ts": "export class FrameworkBase { framework() { return 1; } }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "ProductionService.run"'))).toBe(false);
	});

	test("resolves an imported aliased base without using a same-named unrelated class", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"base.ts": "export class FrameworkBase { framework() { return 1; } }",
				"source.ts":
					"import { FrameworkBase as Base } from './base'; export class ProductionService extends Base { run() { return 1; } }",
				"unrelated.ts": "export class FrameworkBase { unrelated() { return 1; } }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "ProductionService.run"'))).toBe(true);
	});

	test("resolves method usage through a renamed re-export", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"implementation.ts": "export class Service { public execute(): number { return 1; } }",
				"facade.ts": "export { Service as PublicService } from './implementation';",
				"consumer.ts":
					"import { PublicService } from './facade'; const service = new PublicService(); service.execute();",
				"other.ts": "export class Service { public execute(): number { return 2; } }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((violation) => violation.rule_id === "unused-callable").map((violation) => violation.file),
		).toEqual(["other.ts"]);
	});

	test("resolves a property constructor through an imported alias", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"service.ts": "export class Service { public execute(): number { return 1; } }",
				"other.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts":
					"import { Service as Alias } from './service'; class Holder { service: Alias = new Alias(); } new Holder().service.execute();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((violation) => violation.rule_id === "unused-callable").map((violation) => violation.file),
		).toEqual(["other.ts"]);
	});

	test("resolves an imported holder property to its service file", () => {
		const root = "/virtual/property-holder-identity";
		const source_files = identity_fixture.source_files(root, {
			"first.ts": "export class Service { public execute(): number { return 1; } }",
			"first-holder.ts": [
				"import { Service } from './first';",
				"export class Holder { public service = new Service(); }",
			].join("\n"),
			"consumer.ts": [
				"import { Holder as FirstHolder } from './first-holder';",
				"function first_use(): number { const holder = new FirstHolder(); return holder.service.execute(); }",
			].join("\n"),
		});
		const consumer = identity_fixture.required_source_file(source_files, `${root}/consumer.ts`);
		const access = identity_fixture.property_access(consumer, "execute");
		const identity = new TypeScriptReferenceIdentity(consumer, root, source_files, new EmptySourceText());
		const resolution = identity.method_reference(access, "Holder");

		expect(resolution).toEqual({ name: "execute", target_file: "first.ts" });
	});

	test("keeps same-named properties tied to their declaring class", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"class HolderA { service = new First(); run(): number { return this.service.execute(); } }",
					"class HolderB { service = new Second(); }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("does not let an ordinary method parameter overwrite a field owner", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"real.ts": "export class Real { public run(): number { return 1; } }",
				"other.ts": "export class Other { public run(): number { return 2; } }",
				"consumer.ts": [
					"import { Real } from './real';",
					"import { Other } from './other';",
					"class Client {",
					"  service = new Real();",
					"  execute(service: Other): number { return this.service.run(); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "real.ts" || file === "other.ts"),
		).toEqual(["other.ts"]);
	});

	test("keeps same-named imported class instances tied to their declaration file", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts":
					"import { Service as First } from './first'; import { Service as Second } from './second'; const used = new First(); used.execute();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("updates an instance identity after a direct reassignment", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts": [
					"import { Service as First } from './first';",
					"import { Service as Second } from './second';",
					"let used = new First();",
					"used.execute();",
					"used = new Second();",
					"used.execute();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual([]);
	});

	test("keeps wrapped constructors tied to their constructed class file", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class Service { public execute(): number { return 1; } }",
				"second.ts": "export class Service { public execute(): number { return 2; } }",
				"consumer.ts":
					"import { Service as First } from './first'; import { Service as Second } from './second'; const used: First = (new Second()); used.execute();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts"]);
	});
});
