import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, jest, test } from "@jest/globals";
import { TestDataFactory } from "tests/core/test-data-factory";

import { SharedParameterAnalyzer } from "src/metrics/shared_parameter_analyzer";
import { SharedParameterOrder } from "src/metrics/shared_parameter_order";
import type { AnalyzedParameter } from "src/metrics/types";

/** Responsibilities: _overlapping parameter construction_, _intersection scenario access_. **/
class ExactIntersectionCases {
	public readonly callables: ReturnType<TestDataFactory["analyzed_callable"]>[];

	/** Responsibilities: _intersection fixture callables setup_. **/
	public constructor() {
		const test_data_factory = new TestDataFactory();
		this.callables = Array.from({ length: 10 }, (_, index) => {
			const parameters: AnalyzedParameter[] = [];
			if (index < 8) {
				parameters.push(test_data_factory.reference_parameter("ProjectA"));
			}
			if (index >= 4) {
				parameters.push(test_data_factory.reference_parameter("ProjectB"));
			}
			return test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters);
		});
	}

	/** Responsibilities: _overlapping candidate fixture construction_. **/
	public overlapping_extensions(): ReturnType<TestDataFactory["analyzed_callable"]>[] {
		const test_data_factory = new TestDataFactory();
		const shared_reference = test_data_factory.reference_parameter("Project");
		const x = test_data_factory.primitive_parameter("x", "string");
		const y = test_data_factory.primitive_parameter("y", "string");
		const z = test_data_factory.primitive_parameter("z", "string");
		const parameter_groups = [
			[shared_reference, x, y],
			[shared_reference, x, y, z],
			[shared_reference, x, y, z],
			[shared_reference, x, z],
			[shared_reference, y, z],
		];
		return parameter_groups.map((parameters, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters),
		);
	}
}

describe("shared parameter analyzer - reference intersections", () => {
	test("keeps one primitive node independent across reference roots", () => {
		const test_data_factory = new TestDataFactory();

		const id = test_data_factory.primitive_parameter("id", "string");
		const callables = [
			...Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_a${index}`, index + 1, [
					test_data_factory.reference_parameter("ProjectA"),
					id,
				]),
			),
			...Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_b${index}`, index + 10, [
					test_data_factory.reference_parameter("ProjectB"),
					id,
				]),
			),
		];
		const analyzer = new SharedParameterAnalyzer(callables);

		const candidates = analyzer.collect_candidates();
		const project_a_candidates = test_data_factory.candidate_named(candidates, "ProjectA, id:string");
		const project_b_candidates = test_data_factory.candidate_named(candidates, "ProjectB, id:string");
		const project_a = project_a_candidates[0];
		const project_b = project_b_candidates[0];

		expect({
			project_a: project_a?.locations.length,
			project_b: project_b?.locations.length,
			combined: test_data_factory.candidate_named(candidates, "ProjectA, ProjectB, id:string"),
		}).toEqual({ project_a: 4, project_b: 4, combined: [] });
	});

	test("keeps disjoint bundles with equal support and different sizes", () => {
		const test_data_factory = new TestDataFactory();
		const id = test_data_factory.primitive_parameter("id", "string");
		const scope = test_data_factory.primitive_parameter("scope", "string");
		const callables = [
			...Array.from({ length: 3 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_a${index}`, index + 1, [
					test_data_factory.reference_parameter("ProjectA"),
					id,
				]),
			),
			...Array.from({ length: 3 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_b${index}`, index + 10, [
					test_data_factory.reference_parameter("ProjectB"),
					id,
					scope,
				]),
			),
		];

		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();
		const project_a_candidates = test_data_factory.candidate_named(candidates, "ProjectA, id:string");
		const project_b_candidates = test_data_factory.candidate_named(candidates, "ProjectB, id:string, scope:string");
		const project_a = project_a_candidates[0];
		const project_b = project_b_candidates[0];

		expect({
			project_a: project_a?.support,
			project_b: project_b?.support,
		}).toEqual({ project_a: 3, project_b: 3 });
	});

	test("uses the exact intersection instead of either node support", () => {
		const test_data_factory = new TestDataFactory();
		const exact_cases = new ExactIntersectionCases();
		const analyzer = new SharedParameterAnalyzer(exact_cases.callables);
		const candidates = analyzer.collect_candidates();
		const project_a_candidates = test_data_factory.candidate_named(candidates, "ProjectA");
		const project_b_candidates = test_data_factory.candidate_named(candidates, "ProjectB");
		const combined_candidates = test_data_factory.candidate_named(candidates, "ProjectA, ProjectB");
		const project_a = project_a_candidates[0];
		const project_b = project_b_candidates[0];
		const combined = combined_candidates[0];

		expect({
			project_a: project_a?.support,
			project_b: project_b?.support,
			combined: combined?.support,
		}).toEqual({ project_a: 8, project_b: 6, combined: 4 });
	});

	test("keeps overlapping maximal bundles from competing extensions", () => {
		const test_data_factory = new TestDataFactory();
		const cases = new ExactIntersectionCases();
		const callables = cases.overlapping_extensions();
		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();
		const xz_candidates = test_data_factory.candidate_named(candidates, "Project, x:string, z:string");
		const yz_candidates = test_data_factory.candidate_named(candidates, "Project, y:string, z:string");
		const xz_candidate = xz_candidates[0];
		const yz_candidate = yz_candidates[0];

		expect({
			xz: xz_candidate?.support,
			yz: yz_candidate?.support,
		}).toEqual({ xz: 3, yz: 3 });
	});

	test("does not report a primitive-only node with high support", () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 12 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, [
				test_data_factory.primitive_parameter("id", "string"),
			]),
		);
		const analyzer = new SharedParameterAnalyzer(callables);
		const shared_parameters = analyzer.shared_parameters();
		const parameter_nodes = [...shared_parameters.values()];
		expect(parameter_nodes[0].locations).toHaveLength(12);
		expect(analyzer.collect_candidates()).toEqual([]);
	});

	test("returns the same dictionaries and candidates for reordered input", () => {
		const test_data_factory = new TestDataFactory();

		const parameters = [
			test_data_factory.reference_parameter("ProjectA"),
			test_data_factory.primitive_parameter("id", "string"),
		];
		const callables = Array.from({ length: 4 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters),
		);
		const forward = new SharedParameterAnalyzer(callables);
		const reversed_callables = [...callables];
		reversed_callables.reverse();
		const reordered_callables = reversed_callables.map((callable) => {
			const parameters = [...callable.parameters];
			parameters.reverse();
			return { ...callable, parameters };
		});
		const reversed = new SharedParameterAnalyzer(reordered_callables);

		expect([...reversed.shared_parameters()]).toEqual([...forward.shared_parameters()]);
		expect(reversed.collect_candidates()).toEqual(forward.collect_candidates());
	});

	test("prunes disjoint location branches without composite findings", () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 10 }, (_, type_index) =>
			Array.from({ length: 4 }, (_, location_index) => {
				const type_offset = type_index * 10;
				const location = type_offset + location_index + 1;
				return test_data_factory.analyzed_callable(`type${type_index}_${location_index}`, location, [
					test_data_factory.reference_parameter(`Project${type_index}`),
				]);
			}),
		).flat();

		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();

		expect(candidates).toHaveLength(10);
		expect(candidates.every((candidate) => candidate.nodes.length === 1)).toBe(true);
	});

	test("does not intersect unrelated reference supports", () => {
		const test_data_factory = new TestDataFactory();
		const intersect_locations = jest.spyOn(SharedParameterOrder.prototype, "intersect_locations");
		const callables = Array.from({ length: 20 }, (_, type_index) =>
			Array.from({ length: 3 }, (_, location_index) => {
				const location_base = type_index * 10;
				const location = location_base + location_index + 1;
				return test_data_factory.analyzed_callable(`type${type_index}_${location_index}`, location, [
					test_data_factory.reference_parameter(`Project${type_index}`),
				]);
			}),
		).flat();

		const analyzer = new SharedParameterAnalyzer(callables);
		let candidates: ReturnType<SharedParameterAnalyzer["collect_candidates"]> = [];
		let intersection_count = 0;
		try {
			candidates = analyzer.collect_candidates();
		} finally {
			intersection_count = intersect_locations.mock.calls.length;
			intersect_locations.mockRestore();
		}

		expect({
			candidate_count: candidates.length,
			composite_count: candidates.filter((candidate) => candidate.nodes.length > 1).length,
			intersection_count,
		}).toEqual({ candidate_count: 20, composite_count: 0, intersection_count: 0 });
	});

	test("applies usage and callable support thresholds independently", () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 2 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, [
				test_data_factory.reference_parameter("RecordData"),
			]),
		);
		const below_threshold = new SharedParameterAnalyzer(callables);
		const at_threshold = new SharedParameterAnalyzer([
			...callables,
			test_data_factory.analyzed_callable("read2", 3, [test_data_factory.reference_parameter("RecordData")]),
		]);

		expect(below_threshold.collect_candidates()).toEqual([]);
		expect(at_threshold.collect_candidates()).toEqual([expect.objectContaining({ support: 3 })]);
	});

	test("returns no candidates for a mixed function and method input scope", () => {
		const test_data_factory = new TestDataFactory();

		const callables = [
			test_data_factory.analyzed_callable("read", 1, [test_data_factory.reference_parameter("RecordData")]),
			test_data_factory.analyzed_callable(
				"Service.write",
				2,
				[test_data_factory.reference_parameter("RecordData")],
				"fixture.ts",
				"method",
			),
		];

		const analyzer = new SharedParameterAnalyzer(callables);
		expect(analyzer.collect_candidates()).toEqual([]);
	});
});
