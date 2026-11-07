import { describe, expect, test } from "@jest/globals";
import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { CallableReferenceMatcherScenario } from "tests/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_reference_matcher_scenario";
import { CallableReferenceReplacementScenario } from "tests/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_reference_replacement_scenario";

describe("callable owner reference index", () => {
	test("returns matching usage without scanning unrelated owner references", () => {
		const calls = Array.from({ length: 1_000 }, (_, index) => `worker.unrelated_${index}();`);
		const source_lines = ["class Worker { target() {} }", "declare const worker: Worker;", ...calls];
		source_lines.push("worker.target();");
		const ast_file = new TypeScriptAstFile("worker.ts", source_lines.join("\n"));
		const normalized = ast_file.normalized();
		const scenario = new CallableReferenceMatcherScenario();
		const usage_files = scenario.files_using_target(normalized);

		expect(usage_files).toEqual(new Set(["worker.ts"]));
		expect(scenario.unrelated_reference_visits()).toBe(0);
	});

	test("preserves owner bucket order and duplicate references", () => {
		const source = ["declare const worker: Worker;", "worker.target();", "worker.target();", "worker.target();"].join(
			"\n",
		);
		const ast_file = new TypeScriptAstFile("worker.ts", source);
		const parsed = ast_file.normalized();
		const normalized_references = parsed.references.call_references.map((reference, index) => ({
			...reference,
			target_file: index === 1 ? "target-b.ts" : "target-a.ts",
		}));
		const ast = { ...parsed, references: { ...parsed.references, call_references: normalized_references } };
		const references = new CallableUsageReferences();
		references.append_file({
			file: "worker.ts",
			absolute_file: "worker.ts",
			imports: new Set(),
			ast,
			reference_aliases: [],
		});
		const owner_names = references.snapshot(new Set()).references_by_file.get("worker.ts");
		let target_references: readonly AstCallableReference[] = [];
		if (owner_names !== undefined) {
			target_references = owner_names.owned_references("method", "target");
		}

		expect(target_references.map((reference) => reference.line)).toEqual([1, 3, 2]);
	});

	test("replaces owner buckets when a file AST changes", () => {
		const references = new CallableUsageReferences();
		const scenario = new CallableReferenceReplacementScenario(references);
		scenario.append_source("old_call");
		scenario.append_source("new_call");

		expect({
			old_count: scenario.reference_count("old_call"),
			new_count: scenario.reference_count("new_call"),
		}).toEqual({
			old_count: 0,
			new_count: 1,
		});
	});
});
