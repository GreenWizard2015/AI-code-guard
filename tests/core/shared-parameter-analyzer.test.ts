import { TestDataFactory } from 'tests/core/test-data-factory';
import { describe, expect, test } from '@jest/globals';

import { SharedParameterAnalyzer } from 'src/metrics/shared-parameter-analyzer';

import type { AnalyzerCase } from 'tests/core/types';

/** Responsibilities: _provision reusable shared-parameter analyzer_. **/
class SharedParameterAnalyzerCases {

	private readonly factory = new TestDataFactory();

	/** Responsibilities: _construction callables sharing supplied_. **/
	private callables_with(parameters: readonly ReturnType<TestDataFactory['reference_parameter']>[]): ReturnType<TestDataFactory['analyzed_callable']>[] {
		return Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`full${index + 1}`, index + 1, parameters));
	}

	/** Responsibilities: _construction fixture deterministic node_. **/
	public sorted_nodes(): SharedParameterAnalyzer {
		const record = this.factory.reference_parameter('RecordData');
		const repeated = this.factory.analyzed_callable('third', 3, [record, record], 'b.ts');
		return new SharedParameterAnalyzer([
			this.factory.analyzed_callable('fourth', 4, [record], 'b.ts'), repeated,
			this.factory.analyzed_callable('second', 2, [record], 'a.ts'),
			this.factory.analyzed_callable('first', 1, [record], 'a.ts'), repeated,
		]);
	}

	/** Responsibilities: _construction fixture exact parameter_. **/
	public exact_supports(): AnalyzerCase {
		const value = this.factory.reference_parameter('clazzA');
		const id = this.factory.primitive_parameter('id', 'string');
		const callables = Array.from({ length: 5 }, (_, index) => this.factory.analyzed_callable(`Fa${index + 1}`, index + 1, [value]));
		callables.push(...Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`Fb${index + 6}`, index + 6, [value, id])));
		callables.push(this.factory.analyzed_callable('Fc10', 10, [value, this.factory.primitive_parameter('x', 'string')]));
		callables.push(this.factory.analyzed_callable('Fd11', 11, [value, this.factory.reference_parameter('classX')]));
		return { analyzer: new SharedParameterAnalyzer(callables), factory: this.factory };
	}

	/** Responsibilities: _construction fixture arbitrary parameter_. **/
	public arbitrary_combination(): AnalyzerCase {
		const parameters = [this.factory.reference_parameter('ProjectA'), this.factory.primitive_parameter('id', 'string'), this.factory.reference_parameter('ProjectB'), this.factory.primitive_parameter('scope', 'string')];
		return { analyzer: new SharedParameterAnalyzer(this.callables_with(parameters)), factory: this.factory };
	}

	/** Responsibilities: _construction fixture five-way parameter_. **/
	public length_five(): AnalyzerCase {
		const parameters = [this.factory.reference_parameter('ProjectA'), this.factory.primitive_parameter('id', 'string'), this.factory.reference_parameter('ProjectB'), this.factory.primitive_parameter('scope', 'string'), this.factory.primitive_parameter('active', 'boolean')];
		const callables = Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`full${index}`, index + 1, [...parameters].reverse()));
		return { analyzer: new SharedParameterAnalyzer(callables), factory: this.factory };
	}

	/** Responsibilities: _construction fixture disjoint shared-parameter_. **/
	public disjoint_pairs(): AnalyzerCase {
		const project_a = this.factory.reference_parameter('ProjectA');
		const project_b = this.factory.reference_parameter('ProjectB');
		const id = this.factory.primitive_parameter('id', 'string');
		const callables = [
			...Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`ab${index}`, index + 1, [project_a, project_b])),
			...Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`ai${index}`, index + 10, [project_a, id])),
			...Array.from({ length: 4 }, (_, index) => this.factory.analyzed_callable(`bi${index}`, index + 20, [project_b, id])),
		];
		return { analyzer: new SharedParameterAnalyzer(callables), factory: this.factory };
	}
}


describe('SharedParameterAnalyzer', () => {
	const cases = new SharedParameterAnalyzerCases();

	test('builds sorted nodes with unique file-line-method locations', () => {
		const nodes = [...cases.sorted_nodes().shared_parameters().values()];

		expect(nodes).toHaveLength(1);
		expect(nodes[0].locations).toEqual([
			{ file: 'a.ts', line: 1, method: 'first' },
			{ file: 'a.ts', line: 2, method: 'second' },
			{ file: 'b.ts', line: 3, method: 'third' },
			{ file: 'b.ts', line: 4, method: 'fourth' },
		]);
	});

	test('uses argument name and type for distinct primitive nodes', () => {
		const test_data_factory = new TestDataFactory();

		const analyzer = new SharedParameterAnalyzer([
			test_data_factory.analyzed_callable('read', 1, [
				test_data_factory.primitive_parameter('id', 'string'),
				test_data_factory.primitive_parameter('name', 'string'),
				test_data_factory.primitive_parameter('id', 'number'),
			]),
		]);

		const identities = [...analyzer.shared_parameters().values()].map(node => node.identity);

		expect(identities).toEqual(['id:number', 'id:string', 'name:string']);
	});

	test('keeps reference and primitive nodes separate when their labels match', () => {
		const test_data_factory = new TestDataFactory();

		const parameters = [test_data_factory.reference_parameter('id:string'), test_data_factory.primitive_parameter('id', 'string')];
		const analyzer = new SharedParameterAnalyzer(
			Array.from({ length: 4 }, (_, index) =>
				test_data_factory.analyzed_callable(`read${index}`, index + 1, parameters)
			)
		);

		const nodes = [...analyzer.shared_parameters().values()];
		const composite = analyzer.collect_candidates().find(candidate => candidate.nodes.length === 2);

		expect(nodes.map(node => [node.identity, node.kind])).toEqual([
			['id:string', 'reference'],
			['id:string', 'basic'],
		]);
		expect(composite?.nodes.map(node => node.kind)).toEqual(['reference', 'basic']);
	});

	test('treats equal method names on different lines as distinct locations', () => {
		const test_data_factory = new TestDataFactory();

		const analyzer = new SharedParameterAnalyzer([
			test_data_factory.analyzed_callable(
				'Service.read',
				1,
				[test_data_factory.reference_parameter('RecordData')],
				'service.ts',
				'method'
			),
			test_data_factory.analyzed_callable(
				'Service.read',
				2,
				[test_data_factory.reference_parameter('RecordData')],
				'service.ts',
				'method'
			),
		]);

		const locations = [...analyzer.shared_parameters().values()][0].locations;

		expect(locations).toEqual([
			{ file: 'service.ts', line: 1, method: 'Service.read' },
			{ file: 'service.ts', line: 2, method: 'Service.read' },
		]);
	});

	test('builds exact base supports and qualifying candidates', () => {
		const { analyzer, factory } = cases.exact_supports();

		const nodes = [...analyzer.shared_parameters().values()];
		const supports = new Map(nodes.map(node => [node.identity, node.locations.length]));
		const candidates = analyzer.collect_candidates();

		expect({
		supports,
		candidate_names: candidates.map(item => factory.candidate_name(item)),
		locations: factory.candidate_named(candidates, 'clazzA, id:string')[0]?.locations.map(item => item.method),
	}).toEqual({
		supports: new Map([
			['classX', 1],
			['clazzA', 11],
			['id:string', 4],
			['x:string', 1],
		]),
		candidate_names: ['clazzA', 'clazzA, id:string'],
		locations: ['Fb6', 'Fb7', 'Fb8', 'Fb9'],
		});
	});

	test('returns every reference-rooted subset of an arbitrary combination', () => {
		const { analyzer, factory } = cases.arbitrary_combination();

		const candidates = analyzer.collect_candidates();
		const names = candidates.map(item => factory.candidate_name(item));

		expect({
			count: candidates.length,
			unique_count: new Set(names).size,
			full_name: names.includes('ProjectA, ProjectB, id:string, scope:string'),
			primitive_name: names.includes('id:string'),
			partial_name: names.includes('id:string, scope:string'),
			supports: candidates.every(candidate => candidate.support === 4),
		}).toEqual({
			count: 12,
			unique_count: 12,
			full_name: true,
			primitive_name: false,
			partial_name: false,
			supports: true,
		});
	});

	test('returns qualifying combinations through length five', () => {
		const { analyzer, factory } = cases.length_five();
		const candidates = analyzer.collect_candidates();

		expect({
			count: candidates.length,
			lengths: new Set(candidates.map(candidate => candidate.nodes.length)),
			support: factory.candidate_named(
				candidates,
				'ProjectA, ProjectB, active:boolean, id:string, scope:string'
			)[0]?.support,
		}).toEqual({ count: 24, lengths: new Set([1, 2, 3, 4, 5]), support: 4 });
	});

	test('does not infer a triple from three disjoint pair groups', () => {
		const { analyzer, factory } = cases.disjoint_pairs();

		const names = analyzer.collect_candidates().map(item => factory.candidate_name(item));

		expect(names).toEqual([
			'ProjectA',
			'ProjectB',
			'ProjectA, ProjectB',
			'ProjectA, id:string',
			'ProjectB, id:string',
		]);
		expect(names).not.toContain('ProjectA, ProjectB, id:string');
	});

});
