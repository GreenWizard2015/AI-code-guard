import { TestDataFactory } from 'tests/core/test-data-factory';
import { describe, expect, test } from '@jest/globals';

import { SharedParameterAnalyzer } from 'src/metrics/shared-parameter-analyzer';
import type { AnalyzedParameter } from 'src/metrics/types';

	/** Responsibilities: _construction exact shared-parameter intersection_. **/
class ExactIntersectionCases {
	public readonly callables: ReturnType<TestDataFactory['analyzed_callable']>[];

	/** Responsibilities: _intersection fixture callables setup_. **/
	public constructor() {
		const test_data_factory = new TestDataFactory();
		this.callables = Array.from({ length: 10 }, (_, index) => {
			const parameters: AnalyzedParameter[] = [];
			if (index < 8) {
				parameters.push(test_data_factory.reference_parameter('ProjectA'));
			}
			if (index >= 4) {
				parameters.push(test_data_factory.reference_parameter('ProjectB'));
			}
			return test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters);
		});
	}
}


describe('shared parameter analyzer - reference intersections', () => {
	test('keeps one primitive node independent across reference roots', () => {
		const test_data_factory = new TestDataFactory();

		const id = test_data_factory.primitive_parameter('id', 'string');
		const callables = [
			...Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_a${index}`, index + 1, [test_data_factory.reference_parameter('ProjectA'), id])
			),
			...Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`from_b${index}`, index + 10, [test_data_factory.reference_parameter('ProjectB'), id])
			),
		];
		const analyzer = new SharedParameterAnalyzer(callables);

		const candidates = analyzer.collect_candidates();

		expect({
			project_a: test_data_factory.candidate_named(candidates, 'ProjectA, id:string')[0]?.locations.length,
			project_b: test_data_factory.candidate_named(candidates, 'ProjectB, id:string')[0]?.locations.length,
			combined: test_data_factory.candidate_named(candidates, 'ProjectA, ProjectB, id:string'),
		}).toEqual({ project_a: 4, project_b: 4, combined: [] });
	});

	test('uses the exact intersection instead of either node support', () => {
		const test_data_factory = new TestDataFactory();
		const analyzer = new SharedParameterAnalyzer(new ExactIntersectionCases().callables);
		const candidates = analyzer.collect_candidates();

		expect({
			project_a: test_data_factory.candidate_named(candidates, 'ProjectA')[0]?.support,
			project_b: test_data_factory.candidate_named(candidates, 'ProjectB')[0]?.support,
			combined: test_data_factory.candidate_named(candidates, 'ProjectA, ProjectB')[0]?.support,
		}).toEqual({ project_a: 8, project_b: 6, combined: 4 });
	});

	test('does not report a primitive-only node with high support', () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 12 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, [test_data_factory.primitive_parameter('id', 'string')])
		);
		const analyzer = new SharedParameterAnalyzer(callables);

		expect([...analyzer.shared_parameters().values()][0].locations).toHaveLength(12);
		expect(analyzer.collect_candidates()).toEqual([]);
	});

	test('returns the same dictionaries and candidates for reordered input', () => {
		const test_data_factory = new TestDataFactory();

		const parameters = [test_data_factory.reference_parameter('ProjectA'), test_data_factory.primitive_parameter('id', 'string')];
		const callables = Array.from({ length: 4 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters)
		);
		const forward = new SharedParameterAnalyzer(callables);
		const reversed = new SharedParameterAnalyzer(
			[...callables].reverse().map(callable => ({
				...callable,
				parameters: [...callable.parameters].reverse(),
			}))
		);

		expect([...reversed.shared_parameters()]).toEqual([...forward.shared_parameters()]);
		expect(reversed.collect_candidates()).toEqual(forward.collect_candidates());
	});

	test('prunes disjoint location branches without composite findings', () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 10 }, (_, type_index) =>
			Array.from({ length: 4 }, (_, location_index) => {
				const type_offset = type_index * 10;
				const location = type_offset + location_index + 1;
				return test_data_factory.analyzed_callable(
					`type${type_index}_${location_index}`,
					location,
					[test_data_factory.reference_parameter(`Project${type_index}`)]
				);
			})
		).flat();

		const analyzer = new SharedParameterAnalyzer(callables);
		const candidates = analyzer.collect_candidates();

		expect(candidates).toHaveLength(10);
		expect(candidates.every(candidate => candidate.nodes.length === 1)).toBe(true);
	});

	test('applies usage and callable support thresholds independently', () => {
		const test_data_factory = new TestDataFactory();

		const callables = Array.from({ length: 2 }, (_, index) =>
			test_data_factory.analyzed_callable(`read${index}`, index + 1, [test_data_factory.reference_parameter('RecordData')])
		);
		const below_threshold = new SharedParameterAnalyzer(callables);
		const at_threshold = new SharedParameterAnalyzer([
			...callables,
			test_data_factory.analyzed_callable('read2', 3, [test_data_factory.reference_parameter('RecordData')]),
		]);

		expect(below_threshold.collect_candidates()).toEqual([]);
		expect(at_threshold.collect_candidates()).toEqual([expect.objectContaining({ support: 3 })]);
	});

	test('returns no candidates for a mixed function and method input scope', () => {
		const test_data_factory = new TestDataFactory();

		const callables = [
			test_data_factory.analyzed_callable('read', 1, [test_data_factory.reference_parameter('RecordData')]),
			test_data_factory.analyzed_callable(
				'Service.write',
				2,
				[test_data_factory.reference_parameter('RecordData')],
				'fixture.ts',
				'method'
			),
		];

		const analyzer = new SharedParameterAnalyzer(callables);
		expect(analyzer.collect_candidates()).toEqual([]);
	});
});
