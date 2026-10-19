import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptSingletonCollector } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_collector";

describe("singleton alias architecture", () => {
	test("reports singleton constructors through spread object aliases", () => {
		const file = "spread-object-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { ...{ service_class: Service } };",
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

	test("resolves the final property in spread object aliases", () => {
		const file = "spread-override-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { service_class: Object, ...{ service_class: Service } };",
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

	test("reports singleton constructors through quoted object keys", () => {
		const file = "quoted-object-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { 'service_class': Service };",
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

	test("reports singleton constructors through wrapped object values", () => {
		const file = "wrapped-object-value.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { service_class: (Service) };",
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

	test("reports singleton constructors through namespace object values", () => {
		const file = "namespace-object-value.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"import * as service_module from './service';",
				"class Service { public run(): void {} }",
				"const constructors = { service_class: service_module.Service };",
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

	test("reports singleton constructors through namespace element access", () => {
		const file = "consumer.ts";
		const source_file = ts.createSourceFile(
			file,
			["import * as Domain from './service';", "const service = new Domain['Service']();"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through quoted renamed keys", () => {
		const file = "quoted-renamed-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = { service_class: Service };",
				"const { 'service_class': selected_class } = constructors;",
				"const service = new selected_class();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector(file, source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations).toHaveLength(1);
	});

	test("reports singleton constructors through destructuring defaults", () => {
		const file = "destructuring-default-alias.ts";
		const source_file = ts.createSourceFile(
			file,
			[
				"class Service { public run(): void {} }",
				"const constructors = {};",
				"const { service_class = Service } = constructors;",
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
