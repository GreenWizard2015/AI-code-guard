import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import { TypeScriptPropertyState } from "src/parser/references/identity/properties/type_script_property_state";
import { TestFixture } from "tests/core/test-fixture";

/** Responsibilities: _owner resolver_, _instance resolver_. **/
class PropertyStateDependencies {
	/** Responsibilities: _callable ownership resolution_. **/
	public call_owner(_expression: ts.Expression, _owner: string): string {
		return "";
	}

	/** Responsibilities: _instance registration_. **/
	public add(_name: string, _owner: string, ..._nodes: ts.Node[]): void {}

	/** Responsibilities: _instance batch registration_. **/
	public add_all(): void {}

	/** Responsibilities: _destructured instance registration_. **/
	public add_destructured(): void {}

	/** Responsibilities: _instance lookup_. **/
	public instance_owner(_name: string, _node: ts.Node): { bound: boolean; value: string } {
		return { bound: false, value: "" };
	}
}

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
		const state = new TypeScriptPropertyState(
			new Map<string, string>(),
			new PropertyStateDependencies(),
			new PropertyStateDependencies(),
		);
		state.append_tree(source, "");
		expect({
			static_owner: state.property_owner("Service", "dependency", "static"),
			instance_owner: state.property_owner("Service", "dependency", "instance"),
		}).toEqual({ static_owner: "StaticDependency", instance_owner: "InstanceDependency" });
	});

	test("resolves inherited method usage to its declaration file", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"base.ts": "export class Base { execute(): number { return 1; } }",
				"child.ts": "import { Base } from './base'; export class Child extends Base {}",
				"consumer.ts": "import { Child } from './child'; const child = new Child(); child.execute();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "base.ts" || file === "child.ts"),
		).toEqual([]);
	});

	test("keeps static and instance field references on their declaration files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "static-dependency.ts" || file === "instance-dependency.ts"),
		).toEqual([]);
	});
});
