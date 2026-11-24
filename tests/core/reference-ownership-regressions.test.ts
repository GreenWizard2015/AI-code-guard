import "src/callable_usage";
import assert from "node:assert/strict";
import { describe, expect, test } from "@jest/globals";
import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import type { CallOwnerResolverContract } from "src/model/protocols";
import { TypeScriptReferenceResolution } from "src/model/typescript/type_script_reference_resolution";
import { TypeScriptCallReturns } from "src/parser/references/identity/calls/type_script_call_returns";
import { TypeScriptInstanceIndex } from "src/parser/references/identity/instances/type_script_instance_index";
import { TypeScriptPropertyState } from "src/parser/references/identity/properties/type_script_property_state";
import { TypeScriptThisReceiver } from "src/parser/references/instance/type_script_this_receiver";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

describe("reference ownership regressions", () => {
	const source_file_map_cache = new SourceFileMapCache();
	test("resolves the latest instance binding before each reference", () => {
		const source = ts.createSourceFile(
			"service.ts",
			"let service = new First(); const before = service; service = new Second(); const after = service; service = unknown; const unresolved = service;",
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = source.statements
			.filter(ts.isVariableStatement)
			.flatMap((statement) => statement.declarationList.declarations);
		const assignments = source.statements
			.filter(ts.isExpressionStatement)
			.map((statement) => statement.expression)
			.filter(ts.isBinaryExpression);
		const [instance_declaration, before, after, unresolved] = declarations;
		const [reassignment, unresolved_assignment] = assignments;
		const index = new TypeScriptInstanceIndex(source);
		index.add("service", "FirstOwner", instance_declaration ?? source);
		index.add("service", "SecondOwner", reassignment ?? source);
		index.add("service", "", unresolved_assignment ?? source);

		expect({
			before: index.instance_owner("service", before ?? source),
			after: index.instance_owner("service", after ?? source),
			unresolved: index.instance_owner("service", unresolved ?? source),
		}).toEqual({
			before: { bound: true, value: "FirstOwner" },
			after: { bound: true, value: "SecondOwner" },
			unresolved: { bound: true, value: "" },
		});
	});

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
			assert.ok(method && method.body);
			const statement = method.body.statements.find(ts.isReturnStatement);
			assert.ok(statement && statement.expression);
			owner = receiver.owner(statement.expression);
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

	test("reuses imported callable return analysis across aliases", () => {
		const fixture = new TestFixture();
		const references = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"service.ts": [
					"export class Service { execute(): number { return 1; } }",
					"export function create_service(): Service { return new Service(); }",
				].join("\n"),
				"consumer.ts": [
					"import { Service, create_service as first_factory, create_service as second_factory } from './service';",
					"first_factory().execute();",
					"second_factory().execute();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => {
				const execution = production_lint_configuration.lint_report(options, mode);
				const consumer = execution.context.files().find((source) => source.relative_path === "consumer.ts");
				if (consumer === undefined) {
					return [];
				}
				const { references } = consumer.normalized_ast;
				return references.call_references.filter((reference) => reference.name === "execute");
			},
		);
		expect(references).toEqual([
			expect.objectContaining({ kind: "method", name: "execute", owner: "Service" }),
			expect.objectContaining({ kind: "method", name: "execute", owner: "Service" }),
		]);
	});

	test("preserves local factory return owners when reusing the file analysis", () => {
		const source = ts.createSourceFile(
			"service.ts",
			"class Service {}\nconst local_factory = (): Service => new Service();",
			ts.ScriptTarget.Latest,
			true,
		);
		const call_returns = new TypeScriptCallReturns(
			source,
			new Map<string, string>(),
			process.cwd(),
			source_file_map_cache.for_map(new Map<string, ts.SourceFile>()),
			new InMemoryProjectSourceIO(new Map()),
		);

		expect(call_returns.owner_for("local_factory", "", INSTANCE_PROPERTY_SIDE)).toBe("Service");
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
