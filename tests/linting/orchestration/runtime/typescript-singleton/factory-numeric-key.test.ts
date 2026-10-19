import ts from "typescript";
import { TypeScriptSingletonCollector } from "src/linting/orchestration/runtime/typescript-singleton/type_script_singleton_collector";
import { describe, expect, test } from "@jest/globals";

describe("static factory object keys", () => {
	test("reports singleton factories through computed object properties in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { ['make']: make };",
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
	test("reports singleton factories through numeric object properties in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { 0: make };",
				"const [{ 0: extracted }] = [group];",
				"const service = extracted();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through computed numeric properties in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { [0]: make };",
				"const [{ 0: extracted }] = [group];",
				"const service = extracted();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through computed binding properties in arrays", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { make };",
				"const [{ ['make']: extracted }] = [group];",
				"const service = extracted();",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const singleton_collector = new TypeScriptSingletonCollector("factory.ts", source_file, new Set(["Service"]));
		const violations = singleton_collector.collect();

		expect(violations.filter((item) => item.rule_id === "singleton")).toHaveLength(1);
	});

	test("reports singleton factories through nested computed binding properties", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			[
				"class Service {}",
				"function make(): Service { return new Service(); }",
				"const group = { group: { make } };",
				"const [{ group: { ['make']: extracted } }] = [group];",
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
