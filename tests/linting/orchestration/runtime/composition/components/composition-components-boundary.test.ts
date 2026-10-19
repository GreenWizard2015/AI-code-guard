import { describe, expect, test } from "@jest/globals";
import "src/linting/orchestration/runtime/composition/constants";
import { CompositionChain } from "src/linting/orchestration/runtime/composition/components/composition_chain";
import { CompositionComponents } from "src/linting/orchestration/runtime/composition/components/composition_components";
import { CompositionBoundaryFixture } from "tests/bridge/ts/core/composition_boundary_fixture";
import type { ClassGraph, CodeClass } from "src/types";

describe("composition analyzer project boundaries", () => {
	test("classifies many independent components with one graph scan", () => {
		const root = process.cwd();
		const classes = new Map<string, CodeClass>();
		for (let index = 0; index < 200; index += 1) {
			const key = `${root}/src/independent-${index}.ts:Independent${index}`;
			classes.set(key, {
				key,
				file: `${root}/src/independent-${index}.ts`,
				line: 0,
				name: `Independent${index}`,
				dependencies: [],
			});
		}
		const graph: ClassGraph = { classes, classes_by_file: new Map(), imports_by_file: new Map() };

		const analyzer = new CompositionComponents(graph);
		const components = analyzer.source_components();

		expect(components).toHaveLength(200);
	});

	test("does not reuse cycle-truncated depth for another source root", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.cycle_context_graph(root, ["Y", "X", "A", "B", "C", "D"]);
		const chain = new CompositionChain(graph);
		const y_key = fixture.cycle_context_key(root, "Y");

		expect(chain.depth(y_key)).toBe(5);
		expect(chain.chain(y_key)).toEqual(["Y", "B", "A", "C", "D"]);
	});

	test("keeps cycle depth stable when source roots are reversed", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.cycle_context_graph(root, ["X", "Y", "A", "B", "C", "D"]);
		const chain = new CompositionChain(graph);
		const y_key = fixture.cycle_context_key(root, "Y");

		expect(chain.depth(y_key)).toBe(5);
		expect(chain.chain(y_key)).toEqual(["Y", "B", "A", "C", "D"]);
	});

	test("bounds witness search for dense cyclic graphs", () => {
		const root = process.cwd();
		const classes = new Map<string, CodeClass>();
		const keys = Array.from({ length: 12 }, (_, index) => `${root}/src/dense-${index}.ts:Dense${index}`);
		for (const [index, key] of keys.entries()) {
			classes.set(key, {
				key,
				file: `${root}/src/dense-${index}.ts`,
				line: 0,
				name: `Dense${index}`,
				dependencies: keys.filter((dependency) => dependency !== key),
			});
		}
		const graph: ClassGraph = { classes, classes_by_file: new Map(), imports_by_file: new Map() };
		const chain = new CompositionChain(graph);
		const first_key = `${root}/src/dense-0.ts:Dense0`;
		const depth = chain.depth(first_key);
		expect(depth).toBeGreaterThan(3);
		expect(depth).toBeLessThanOrEqual(6);
	});
});
