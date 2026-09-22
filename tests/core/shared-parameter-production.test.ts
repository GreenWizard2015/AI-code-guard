import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';


describe('shared parameter integration - production boundaries', () => {
	test('does not combine production and test functions', () => {
		const test_fixture = new TestFixture();

		const production = [
			'class SharedInput {}',
			'function first(value: SharedInput) { return value; }',
			'function second(value: SharedInput) { return value; }',
		].join('\n');
		const tests = [
			'function fourth(value: SharedInput) { return value; }',
			'function fifth(value: SharedInput) { return value; }',
		].join('\n');
		const violations = test_fixture.collect_fixture_violations({
			'production.ts': production,
			'tests/shared.test.ts': tests,
		});

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test('reports Python functions with a primitive parameter combination', () => {
		const test_fixture = new TestFixture();

		const functions = Array.from(
			{ length: 4 },
			(_, index) => `def run_${index}(value: ProjectData, id: str):\n    return value, id`
		);
		const violations = test_fixture.collect_fixture_violations({
			'shared.py': ['class ProjectData:', '    pass', '', ...functions].join('\n'),
		});
		const shared = test_fixture.shared_violations(violations).filter(item =>
			item.message.startsWith('multiple functions')
		);

		expect({
			count: shared.length,
			project_data: shared.some(item => item.message.includes('parameter type "ProjectData"')),
			combination: shared.some(item => item.message.includes('parameter combination "ProjectData, id:str"')),
		}).toEqual({ count: 2, project_data: true, combination: true });
	});

	test('groups one reference type across different argument names', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'names.ts': [
				'class RequestData {}',
				'function first(request: RequestData) { return request; }',
				'function second(context: RequestData) { return context; }',
				'function third(value: RequestData) { return value; }',
				'function fourth(input: RequestData) { return input; }',
			].join('\n'),
		});

		const shared = test_fixture.shared_violations(violations);
		expect(shared).toHaveLength(1);
		expect(shared[0].message).toContain('parameter type "RequestData"');
	});

	test.each([
		[
			'TypeScript',
			{
				'model.ts': 'export class RequestData {}',
				'alias.ts': [
					"import { RequestData as RequestAlias } from './model';",
					'function first(value: RequestAlias) { return value; }',
					'function second(value: RequestAlias) { return value; }',
				].join('\n'),
				'original.ts': [
					"import { RequestData } from './model';",
					'function third(value: RequestData) { return value; }',
					'function fourth(value: RequestData) { return value; }',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'model.py': ['class RequestData:', '    pass'].join('\n'),
				'alias.py': [
					'from model import RequestData as RequestAlias',
					'',
					'def first(value: RequestAlias):',
					'    return value',
					'',
					'def second(value: RequestAlias):',
					'    return value',
				].join('\n'),
				'original.py': [
					'from model import RequestData',
					'',
					'def third(value: RequestData):',
					'    return value',
					'',
					'def fourth(value: RequestData):',
					'    return value',
				].join('\n'),
			},
		],
	])('normalizes %s import aliases to the original reference identity', (_language, files) => {
		const test_fixture = new TestFixture();
		const file_count = Object.keys(files).length;

		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({
			file_count_positive: file_count > 0,
			count: shared.length,
			request_data: shared[0].message.includes('parameter type "RequestData"'),
			alias: shared[0].message.includes('RequestAlias'),
		}).toEqual({ file_count_positive: true, count: 1, request_data: true, alias: false });
	});

	test.each([
		[
			'TypeScript',
			{
				'scope.ts': [
					'class SharedInput {}',
					'class Service {',
					'  first(value: SharedInput) { return value; }',
					'  second(value: SharedInput) { return value; }',
					'}',
					'function third(value: SharedInput) { return value; }',
					'function fourth(value: SharedInput) { return value; }',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'scope.py': [
					'class SharedInput:',
					'    pass',
					'',
					'class Service:',
					'    def first(self, value: SharedInput):',
					'        return value',
					'    def second(self, value: SharedInput):',
					'        return value',
					'',
					'def third(value: SharedInput):',
					'    return value',
					'',
					'def fourth(value: SharedInput):',
					'    return value',
				].join('\n'),
			},
		],
	])('does not mix %s functions and methods', (_language, files) => {
		const test_fixture = new TestFixture();
		const file_count = Object.keys(files).length;
		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({ file_count_positive: file_count > 0, shared }).toEqual({ file_count_positive: true, shared: [] });
	});

	test.each([
		[
			'TypeScript',
			{
				'private.ts': [
					'class SharedInput {}',
					'class Service {',
					'  first(value: SharedInput) { return value; }',
					'  second(value: SharedInput) { return value; }',
					'  private hidden(value: SharedInput) { return value; }',
					'}',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'private.py': [
					'class SharedInput:',
					'    pass',
					'',
					'class Service:',
					'    def first(self, value: SharedInput):',
					'        return value',
					'    def second(self, value: SharedInput):',
					'        return value',
					'    def _hidden(self, value: SharedInput):',
					'        return value',
				].join('\n'),
			},
		],
	])('does not let a private %s method complete the support threshold', (_language, files) => {
		const test_fixture = new TestFixture();
		const file_count = Object.keys(files).length;
		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({ file_count_positive: file_count > 0, shared }).toEqual({ file_count_positive: true, shared: [] });
	});

	test.each([
		[
			'TypeScript',
			{
				'receivers.ts': [
					'class Service {',
					'  first(this: Service) { return this; }',
					'  second(this: Service) { return this; }',
					'  third(this: Service) { return this; }',
					'  fourth(this: Service) { return this; }',
					'}',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'receivers.py': [
					'class Service:',
					'    def first(self: Service):',
					'        return self',
					'    def second(self: Service):',
					'        return self',
					'    def third(self: Service):',
					'        return self',
					'    def fourth(self: Service):',
					'        return self',
				].join('\n'),
			},
		],
	])('ignores the %s callable receiver', (_language, files) => {
		const test_fixture = new TestFixture();
		const file_count = Object.keys(files).length;
		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({ file_count_positive: file_count > 0, shared }).toEqual({ file_count_positive: true, shared: [] });
	});
});
