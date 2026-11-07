import { describe, expect, test } from "@jest/globals";
import type { UnusedSymbolDefinition } from "src/core/types";
import { PythonReexportTraversal } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/python_reexport_traversal";
import { UnusedSymbolReferenceScenario } from "tests/linting/orchestration/runtime/global-analysis/unused-symbol-reference-scenario";

describe("Python re-export traversal", () => {
	test("shares visited symbol states between sibling branches", () => {
		const scenario = new UnusedSymbolReferenceScenario();
		const source = scenario.consumer_source();
		const root = new PythonReexportTraversal(source, "Token", new Set(), new Set());
		root.enter();
		const target = { ...source, absolute_path: "/project/target.py" };
		const left = root.fork("Token", target);
		const right = root.fork("Token", target);

		expect({ first_branch: left.enter(), repeated_branch: right.enter() }).toEqual({
			first_branch: true,
			repeated_branch: false,
		});
	});

	test("emits one definition when sibling paths reach the same declaration", () => {
		const scenario = new UnusedSymbolReferenceScenario();
		const source = scenario.consumer_source();
		const root = new PythonReexportTraversal(source, "Token", new Set(), new Set());
		const definition: UnusedSymbolDefinition = {
			file: "/project/source.py",
			line: 3,
			name: "Token",
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		};
		const left = root.fork("Token", { ...source, absolute_path: "/project/left.py" });
		const right = root.fork("Token", { ...source, absolute_path: "/project/right.py" });

		expect({
			first: left.unique_definitions([definition]).length,
			duplicate: right.unique_definitions([definition]).length,
		}).toEqual({ first: 1, duplicate: 0 });
	});
});
