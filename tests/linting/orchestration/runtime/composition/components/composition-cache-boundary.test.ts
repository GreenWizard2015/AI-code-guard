import { describe, expect, test } from "@jest/globals";
import "src/linting/orchestration/runtime/composition/constants";
import { CompositionChain } from "src/linting/orchestration/runtime/composition/components/composition_chain";
import { CompositionBoundaryFixture } from "tests/bridge/ts/core/composition_boundary_fixture";

describe("composition cache boundaries", () => {
	test("does not let a prior cycle truncate an acyclic source tail", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.cycle_with_acyclic_tail_graph(root);
		const chain = new CompositionChain(graph);

		chain.chain(`${root}/src/A.ts:A`);
		expect(chain.chain(`${root}/src/Y.ts:Y`)).toEqual(["Y", "D", "E", "F"]);
	});

	test("keeps a shared acyclic tail exact after bounded cycle analysis", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.cycle_with_acyclic_tail_graph(root);
		const chain = new CompositionChain(graph);

		chain.chain(`${root}/src/A.ts:A`);
		expect(chain.depth(`${root}/src/Y.ts:Y`)).toBe(4);
	});
});
