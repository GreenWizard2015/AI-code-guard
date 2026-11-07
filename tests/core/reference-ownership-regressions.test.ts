import "src/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { CallOwnerResolverContract } from "src/model/protocols";
import { TypeScriptReferenceResolution } from "src/model/type_script_reference_resolution";
import { TypeScriptInstanceIndex } from "src/parser/references/identity/instances/type_script_instance_index";
import { TypeScriptPropertyState } from "src/parser/references/identity/properties/type_script_property_state";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

describe("reference ownership regressions", () => {
	test("resolves this from an instance field initializer", () => {
		const source = ts.createSourceFile(
			"service.ts",
			"class Service { callback = this; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const receiver = new TypeScriptThisReceiver(source, new Map<string, string>());
		let owner = "";
		const class_node = source.statements.find(ts.isClassDeclaration);
		if (class_node !== undefined) {
			const field = class_node.members.find(ts.isPropertyDeclaration);
			if (field !== undefined && field.initializer !== undefined) {
				owner = receiver.owner(field.initializer);
			}
		}
		expect(owner).toBe("Service");
	});

	test("resolves this from an instance method", () => {
		const source = ts.createSourceFile(
			"service.ts",
			"class Service { run() { return this; } }",
			ts.ScriptTarget.Latest,
			true,
		);
		const receiver = new TypeScriptThisReceiver(source, new Map<string, string>());
		let owner = "";
		const class_node = source.statements.find(ts.isClassDeclaration);
		if (class_node !== undefined) {
			const method = class_node.members.find(ts.isMethodDeclaration);
			const statement = method?.body?.statements.find(ts.isReturnStatement);
			if (statement?.expression !== undefined) {
				owner = receiver.owner(statement.expression);
			}
		}
		expect(owner).toBe("Service");
	});

	test("keeps static and instance property slots separate", () => {
		const source = ts.createSourceFile(
			"service.ts",
			"class Service { static dependency: StaticDependency; dependency: InstanceDependency; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const call_owner: CallOwnerResolverContract = {
			resolve_reference: () => new TypeScriptReferenceResolution(""),
		};
		const state = new TypeScriptPropertyState(
			new Map<string, string>(),
			call_owner,
			new TypeScriptInstanceIndex(source),
		);
		state.append_tree(source);
		expect({
			static_owner: state.property_owner({ owner: "Service", property: "dependency", side: "static" }),
			instance_owner: state.property_owner({ owner: "Service", property: "dependency", side: "instance" }),
		}).toEqual({ static_owner: "StaticDependency", instance_owner: "InstanceDependency" });
	});

	test("resolves inherited method usage to its declaration file", () => {
		const fixture = new TestFixture();
		const result = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"base.ts": "export class Base { execute(): number { return 1; } }",
				"child.ts": "import { Base } from './base'; export class Child extends Base {}",
				"consumer.ts": "import { Child } from './child'; const child = new Child(); child.execute();",
			},
			(production_lint_configuration, options, mode) => {
				const execution = production_lint_configuration.lint_report(options, mode);
				const consumer_sources = execution.context.files().filter((source) => source.relative_path === "consumer.ts");
				const call_references = consumer_sources.flatMap((source) => {
					const { call_references } = source.normalized_ast.references;
					return call_references.filter((reference) => reference.name === "execute");
				});
				return {
					violations: execution.report.violations,
					references: call_references,
				};
			},
		);
		expect(result.references).toEqual([
			expect.objectContaining({ kind: "method", name: "execute", target_file: "base.ts", owner: "Child" }),
		]);
		expect(
			result.violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "base.ts" || file === "child.ts"),
		).toEqual([]);
	});

	test("keeps static and instance field references on their declaration files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"static-dependency.ts": "export class StaticDependency { execute(): number { return 1; } }",
				"instance-dependency.ts": "export class InstanceDependency { execute(): number { return 2; } }",
				"consumer.ts": [
					"import { StaticDependency } from './static-dependency';",
					"import { InstanceDependency } from './instance-dependency';",
					"class Service {",
					"  static dependency = new StaticDependency();",
					"  dependency = new InstanceDependency();",
					"  static run(): number { return Service.dependency.execute(); }",
					"  run(): number { return this.dependency.execute(); }",
					"}",
					"Service.run(); new Service().run();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.file())
				.filter((file) => file === "static-dependency.ts" || file === "instance-dependency.ts"),
		).toEqual([]);
	});
});
