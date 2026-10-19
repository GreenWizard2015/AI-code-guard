import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptSingletonCollector } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_collector";

describe("singleton alias architecture rules", () => {
	test("reports singleton constructors through parenthesized aliases", () => {
		const file = "parenthesized-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const service_class = (Service);",
				"const service = new service_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through type assertions", () => {
		const file = "type-assertion-instance.ts";
		const source_file = ts.createSourceFile(
			file,
			["class Service { public run(): void {} }", "const service = new (Service as typeof Service)();"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through mixed type wrappers", () => {
		const file = "mixed-type-wrapper-instance.ts";
		const source_file = ts.createSourceFile(
			file,
			["class Service { public run(): void {} }", "const service = new (Service! as typeof Service)();"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through non-null aliases", () => {
		const file = "non-null-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const service_class = Service!;",
				"const service = new service_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through object source aliases", () => {
		const file = "object-source-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { service_class: Service };",
				"const { service_class } = constructors;",
				"const service = new service_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton factories through object properties", () => {
		const file = "object-factory-property.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const factories = { create: (): Service => new Service() };",
				"const service = factories.create();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through array source aliases", () => {
		const file = "array-source-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = [Service];",
				"const [service_class] = constructors;",
				"const service = new service_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through wrapped array elements", () => {
		const file = "wrapped-array-element.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = [(Service)];",
				"const [service_class] = constructors;",
				"const service = new service_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});
});
