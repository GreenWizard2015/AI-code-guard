import { describe, expect, test } from "@jest/globals";
import { CompositionAnalyzer } from "src/linting/orchestration/runtime/composition/components/composition_analyzer";
import type { ClassGraph, CodeClass } from "src/model/types/types";

describe("composition analyzer project boundaries", () => {
	test("reports more than five distinct project dependencies", () => {
		const root = process.cwd();
		const dependencies = Array.from(
			{ length: 6 },
			(_, index) => `${root}/src/dependency-${index}.ts:Dependency${index}`,
		);
		const owner = `${root}/src/owner.ts:Owner`;
		const graph: ClassGraph = {
			classes: new Map([[owner, { key: owner, file: `${root}/src/owner.ts`, line: 4, name: "Owner", dependencies }]]),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		const analyzer = new CompositionAnalyzer(graph, root);

		const violations = analyzer.violations();

		expect({
			length: violations.length,
			rule_id: violations[0]?.rule_id,
			line: violations[0]?.line,
		}).toEqual({ length: 1, rule_id: "constructor-dependency-count", line: 5 });
	});

	test("counts one project dependency once", () => {
		const root = process.cwd();
		const dependency = `${root}/src/dependency.ts:Dependency`;
		const owner = `${root}/src/owner.ts:Owner`;
		const graph: ClassGraph = {
			classes: new Map([
				[
					owner,
					{ key: owner, file: `${root}/src/owner.ts`, line: 0, name: "Owner", dependencies: [dependency, dependency] },
				],
			]),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		const analyzer = new CompositionAnalyzer(graph, root);

		expect(analyzer.violations()).toHaveLength(0);
	});

	test("does not exempt source files from depth checks", () => {
		const root = process.cwd();
		const first = `${root}/src/first.ts:First`;
		const second = `${root}/src/second.ts:Second`;
		const third = `${root}/src/third.ts:Third`;
		const fourth = `${root}/src/fourth.ts:Fourth`;
		const graph: ClassGraph = {
			classes: new Map<string, CodeClass>([
				[first, { key: first, file: `${root}/src/first.ts`, line: 0, name: "First", dependencies: [second] }],
				[second, { key: second, file: `${root}/src/second.ts`, line: 0, name: "Second", dependencies: [third] }],
				[third, { key: third, file: `${root}/src/third.ts`, line: 0, name: "Third", dependencies: [fourth] }],
				[fourth, { key: fourth, file: `${root}/src/fourth.ts`, line: 0, name: "Fourth", dependencies: [] }],
			]),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		const analyzer = new CompositionAnalyzer(graph, root);
		const violations = analyzer.violations();

		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule_id).toBe("composition-depth");
	});

	test("does not exempt test files from depth checks", () => {
		const root = process.cwd();
		const first = `${root}/tests/first.ts:First`;
		const second = `${root}/tests/second.ts:Second`;
		const third = `${root}/tests/third.ts:Third`;
		const fourth = `${root}/tests/fourth.ts:Fourth`;
		const graph: ClassGraph = {
			classes: new Map<string, CodeClass>([
				[first, { key: first, file: `${root}/tests/first.ts`, line: 0, name: "First", dependencies: [second] }],
				[second, { key: second, file: `${root}/tests/second.ts`, line: 0, name: "Second", dependencies: [third] }],
				[third, { key: third, file: `${root}/tests/third.ts`, line: 0, name: "Third", dependencies: [fourth] }],
				[fourth, { key: fourth, file: `${root}/tests/fourth.ts`, line: 0, name: "Fourth", dependencies: [] }],
			]),
			classes_by_file: new Map(),
			imports_by_file: new Map(),
		};
		const analyzer = new CompositionAnalyzer(graph, root);
		const violations = analyzer.violations();

		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule_id).toBe("composition-depth");
	});
});
