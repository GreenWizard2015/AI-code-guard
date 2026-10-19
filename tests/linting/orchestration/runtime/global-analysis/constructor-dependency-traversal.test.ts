import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptConstructorDependencies } from "src/linting/orchestration/runtime/global-analysis/type_script_constructor_dependencies";

describe("constructor dependency traversal", () => {
	test("collects nested constructions without duplicating child subtrees", () => {
		const source = ts.createSourceFile(
			"composition.ts",
			"const value = make(new Outer(new Inner()));",
			ts.ScriptTarget.Latest,
			true,
		);
		const collector = new TypeScriptConstructorDependencies(new Set(["Outer", "Inner"]));
		const first = collector.collect_new_expressions(source);
		const second = collector.collect_new_expressions(source);

		expect({ first, same_result_cache: second === first }).toEqual({
			first: ["Outer", "Inner"],
			same_result_cache: true,
		});
	});

	test("preserves construction order and repeated dependencies", () => {
		const source = ts.createSourceFile(
			"composition.ts",
			"const first = new Service(); const second = new Service();",
			ts.ScriptTarget.Latest,
			true,
		);
		const collector = new TypeScriptConstructorDependencies(new Set(["Service"]));

		expect(collector.collect_new_expressions(source)).toEqual(["Service", "Service"]);
	});
});
