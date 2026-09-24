import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { arbitrary_combination_files } from 'tests/core/constants';


describe('shared parameter lint integration', () => {
	test('reports a shared parameter group of three functions', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'three-functions.ts': [
				'class RequestData {}',
				'function first(value: RequestData) { return value; }',
				'function second(value: RequestData) { return value; }',
				'function third(value: RequestData) { return value; }',
			].join('\n'),
		});

		const shared = test_fixture.shared_violations(violations);
		expect({ count: shared.length, support: shared[0].message.includes('(3).') }).toEqual({ count: 1, support: true });
	});

	test('reports one project function group and its primitive combination', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'single.ts': [
				'class RequestData {}',
				'function first(request: RequestData, id: string) { return [request, id]; }',
				'function second(request: RequestData, id: string) { return [request, id]; }',
				'function third(request: RequestData, id: string) { return [request, id]; }',
				'function fourth(request: RequestData, id: string) { return [request, id]; }',
			].join('\n'),
		});
		const shared = test_fixture.shared_violations(violations);

		expect({
			count: shared.length,
			request_data: shared.filter(item => item.message.includes('parameter type "RequestData"')).length,
			combination: shared.filter(item => item.message.includes('parameter combination "RequestData, id:string"')).length,
			primitive: shared.some(item => item.message.includes('parameter type "id:string"')),
			location: shared[0].message.includes('single.ts:2 first'),
		}).toEqual({ count: 2, request_data: 1, combination: 1, primitive: false, location: true });
	});

	test('finds arbitrary TypeScript combinations without primitive-only findings', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(arbitrary_combination_files);
		const shared = test_fixture.shared_violations(violations).filter(item =>
			item.message.startsWith('multiple functions')
		);

		expect({
			count: shared.length,
			full_combination: shared.filter(item =>
				item.message.includes('parameter combination "ProjectA, ProjectB, id:string, scope:string"')
			).length,
			primitive: shared.some(item => item.message.includes('parameter type "id:string"')),
			primitive_combination: shared.some(item => item.message.includes('parameter combination "id:string')),
		}).toEqual({ count: 12, full_combination: 1, primitive: false, primitive_combination: false });
	});

	test('keeps methods inside their owning class scope', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'classes.ts': [
				'class SharedInput {}',
				'class FirstService {',
				'  first(value: SharedInput) { return value; }',
				'  second(value: SharedInput) { return value; }',
				'}',
				'class SecondService {',
				'  third(value: SharedInput) { return value; }',
				'  fourth(value: SharedInput) { return value; }',
				'}',
			].join('\n'),
		});

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

});
