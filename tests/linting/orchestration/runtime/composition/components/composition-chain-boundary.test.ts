import { describe, expect, test } from "@jest/globals";
import "src/linting/orchestration/runtime/composition/constants";
import { CompositionAnalyzer } from "src/linting/orchestration/runtime/composition/components/composition_analyzer";
import { CompositionBoundaryFixture } from "tests/bridge/ts/core/composition_boundary_fixture";
import { CompositionChain } from "src/linting/orchestration/runtime/composition/components/composition_chain";
import type { ClassGraph, CodeClass } from "src/types";

describe("composition analyzer project boundaries", () => {
	test("reports depth for a rootless cyclic component", () => {
		const root = process.cwd();
		const classes = new Map<string, CodeClass>([
			[
				`${root}/src/A.ts:A`,
				{
					key: `${root}/src/A.ts:A`,
					file: `${root}/src/A.ts`,
					line: 0,
					name: "A",
					dependencies: [`${root}/src/B.ts:B`],
				},
			],
			[
				`${root}/src/B.ts:B`,
				{
					key: `${root}/src/B.ts:B`,
					file: `${root}/src/B.ts`,
					line: 0,
					name: "B",
					dependencies: [`${root}/src/C.ts:C`],
				},
			],
			[
				`${root}/src/C.ts:C`,
				{
					key: `${root}/src/C.ts:C`,
					file: `${root}/src/C.ts`,
					line: 0,
					name: "C",
					dependencies: [`${root}/src/D.ts:D`],
				},
			],
			[
				`${root}/src/D.ts:D`,
				{
					key: `${root}/src/D.ts:D`,
					file: `${root}/src/D.ts`,
					line: 0,
					name: "D",
					dependencies: [`${root}/src/A.ts:A`],
				},
			],
		]);
		const graph: ClassGraph = { classes, classes_by_file: new Map(), imports_by_file: new Map() };
		const analyzer = new CompositionAnalyzer(graph, root);

		const violations = analyzer.violations();

		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule_id).toBe("composition-depth");
	});

	test("reuses shared dependency tails", () => {
		const root = process.cwd();
		const classes = new Map<string, CodeClass>([
			[
				`${root}/src/A.ts:A`,
				{
					key: `${root}/src/A.ts:A`,
					file: `${root}/src/A.ts`,
					line: 0,
					name: "A",
					dependencies: [`${root}/src/B.ts:B`, `${root}/src/C.ts:C`],
				},
			],
			[
				`${root}/src/B.ts:B`,
				{
					key: `${root}/src/B.ts:B`,
					file: `${root}/src/B.ts`,
					line: 0,
					name: "B",
					dependencies: [`${root}/src/D.ts:D`],
				},
			],
			[
				`${root}/src/C.ts:C`,
				{
					key: `${root}/src/C.ts:C`,
					file: `${root}/src/C.ts`,
					line: 0,
					name: "C",
					dependencies: [`${root}/src/D.ts:D`],
				},
			],
			[
				`${root}/src/D.ts:D`,
				{
					key: `${root}/src/D.ts:D`,
					file: `${root}/src/D.ts`,
					line: 0,
					name: "D",
					dependencies: [`${root}/src/E.ts:E`],
				},
			],
			[
				`${root}/src/E.ts:E`,
				{ key: `${root}/src/E.ts:E`, file: `${root}/src/E.ts`, line: 0, name: "E", dependencies: [] },
			],
		]);
		const graph: ClassGraph = { classes, classes_by_file: new Map(), imports_by_file: new Map() };
		const analyzer = new CompositionAnalyzer(graph, root);
		const violations = analyzer.violations();

		expect(violations).toHaveLength(1);
	});

	test("analyzes a deep dependency chain without recursive stack growth", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.deep_graph(root, 5000);

		const analyzer = new CompositionAnalyzer(graph, root);
		const violations = analyzer.violations();
		const chain = new CompositionChain(graph);

		expect(violations).toHaveLength(1);
		expect(chain.depth(`${root}/src/deep-0.ts:Deep0`)).toBe(5000);
	});

	test("does not truncate acyclic tails shared by source roots", () => {
		const root = process.cwd();
		const fixture = new CompositionBoundaryFixture();
		const graph = fixture.shared_acyclic_tail_graph(root);
		const analyzer = new CompositionAnalyzer(graph, root);
		const violations = analyzer.violations();

		expect(violations).toHaveLength(2);
	});
});
