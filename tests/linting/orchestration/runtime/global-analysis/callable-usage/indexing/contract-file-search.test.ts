import { describe, expect, test } from "@jest/globals";
import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { CallableMethodSearchScenario } from "tests/linting/orchestration/runtime/global-analysis/callable-usage/protocol_method_search_scenario";

describe("callable contract import lookup", () => {
	test("keeps protocol import matching independent of unrelated files", () => {
		const scenario = new CallableMethodSearchScenario();
		const small_inventory = scenario.search(0);
		const large_inventory = scenario.search(24);
		const ast_file = new TypeScriptAstFile("consumer.ts", "service.run();");
		const parsed_file = ast_file.normalized();
		const references = new CallableUsageReferences();
		references.append_file({
			file: "consumer.ts",
			absolute_file: "/project/consumer.ts",
			imports: new Set(),
			ast: parsed_file,
			reference_aliases: [],
		});
		const indexed_consumer = references.snapshot(new Set()).files_by_name.has("consumer.ts");

		expect(large_inventory.indexed_candidate_files).toEqual(small_inventory.indexed_candidate_files);
		expect({
			matched_files: large_inventory.matched_files,
			indexed_candidate_files: large_inventory.indexed_candidate_files,
			indexed_consumer,
			excludes_test_consumer: !large_inventory.matched_files.has(large_inventory.test_only_file),
		}).toEqual({
			matched_files: new Set(["consumer.ts"]),
			indexed_candidate_files: new Set(["consumer.ts", "consumer.test.ts"]),
			indexed_consumer: true,
			excludes_test_consumer: true,
		});
	});

	test("indexes source call references by their source file", () => {
		const ast_file = new TypeScriptAstFile("consumer.ts", "service.run();");
		const parsed_file = ast_file.normalized();
		const references = new CallableUsageReferences();
		references.append_file({
			file: "consumer.ts",
			absolute_file: "/project/consumer.ts",
			imports: new Set(),
			ast: parsed_file,
			reference_aliases: [],
		});
		const snapshot = references.snapshot(new Set());
		const indexed_file = snapshot.references_by_file.get("consumer.ts");
		let call_reference_count = 0;
		if (indexed_file !== undefined) {
			call_reference_count = Array.from(indexed_file.values()).flat().length;
		}

		expect({
			file_is_indexed: indexed_file !== undefined,
			call_reference_count,
		}).toEqual({ file_is_indexed: true, call_reference_count: 1 });
	});
});
