import ts from "typescript";
import { TypeScriptSingletonCollector } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_collector";
import { describe, expect, test } from "@jest/globals";

describe("factory alias architecture rules", () => {
	test("reports singleton factory results through array aliases", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const [make] = [create_service];",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through aliased arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = [create_service];",
				"const [make] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through array spreads", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = [...[create_service]];",
				"const [make] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through spread objects", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = { ...{ create_service } };",
				"const { create_service: make } = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factory results through computed object keys", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = { ['create_service']: create_service };",
				"const { create_service: make } = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton inline factories in object registries", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"const factories = { create_service: () => new Service() };",
				"const { create_service: make } = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through parenthesized array elements", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const factories = [(create_service)];",
				"const [make] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through nested array destructuring", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function create_service(): Service { return new Service(); }",
				"const [[make]] = [[create_service]];",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports inline singleton factories through nested arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			["class Service {}", "const [[make]] = [[() => new Service()]];", "const service = make();"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports inline singleton factories through nested objects", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"const factories = { group: { make: () => new Service() } };",
				"const { group: { make } } = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports inline singleton factories through mixed arrays and objects", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"const factories = [{ group: { make: () => new Service() } }];",
				"const [{ group: { make } }] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports inline singleton factories through aliased objects in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"const group = { make: () => new Service() };",
				"const factories = [group];",
				"const [{ make }] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports inline singleton factories through array-object-array aliases", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"const factories = [{ group: { makers: [() => new Service()] } }];",
				"const [{ group: { makers: [make] } }] = factories;",
				"const service = make();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through shorthand object properties in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { make };",
				"const [{ make: extracted }] = [group];",
				"const service = extracted();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});
});
