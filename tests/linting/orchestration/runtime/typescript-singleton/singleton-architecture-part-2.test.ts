import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptSingletonCollector } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_collector";

describe("singleton architecture rules", () => {
	test("reports TypeScript singleton initialization variants", () => {
		const file = "variants.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service {}",
				"function create_service(value: number): Service { return new Service(); }",
				"const with_argument = create_service(1);",
				"export default new Service();",
				"const nested = { service: new Service() };",
				"namespace Scope { export const named = new Service(); }",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.map((item) => item.line)).toEqual([3, 4, 5, 6]);
	});

	test("reports singleton factory results through callable aliases", () => {
		const file = "factory-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const make = create_service;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton factory results through destructured aliases", () => {
		const file = "destructured-factory-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const { create_service: make } = { create_service };",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton factory results through aliased objects", () => {
		const file = "object-factory-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = { create_service };",
				"const { create_service: make } = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports anonymous class singleton initialization", () => {
		const file = "anonymous.ts";
		const source_file = ts.createSourceFile(
			file,
			"const service = new (class Service { run(): void {} })();",
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton factories inside namespaces", () => {
		const file = "namespace-singleton.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service {",
				"\tpublic run(): void {}",
				"}",
				"namespace CandidateNamespace {",
				"\tfunction make_candidate(): Service {",
				"\t\treturn new Service();",
				"\t}",
				"\texport let candidate = make_candidate();",
				"}",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toEqual([expect.objectContaining({ line: 8 })]);
	});

	test("reports singleton constructors through namespace import aliases", () => {
		const file = "consumer.ts";
		const source_file = ts.createSourceFile(
			file,
			["import * as Domain from './service';", "const Api = Domain;", "const service = new Api.Service();"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});
});
