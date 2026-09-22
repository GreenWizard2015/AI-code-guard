import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { deterministic_function_files } from 'tests/core/constants';

describe('shared parameter lint integration', () => {
	test('ignores unconstrained TypeScript template parameters at the support threshold', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'template.ts': [
				'class Service<T> {',
				'  first(value: T) { return value; }',
				'  second(value: T) { return value; }',
				'  third(value: T) { return value; }',
				'  fourth(value: T) { return value; }',
				'}',
			].join('\n'),
		});

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test('supports Python generic reference annotations', () => {
		const test_fixture = new TestFixture();

		const methods = Array.from(
			{ length: 4 },
			(_, index) => `    def method_${index}(self, values: list[Result]):\n        return values`
		);
		const violations = test_fixture.collect_fixture_violations({
			'generic.py': ['class Result:', '    pass', '', 'class Service:', ...methods].join('\n'),
		});

		const shared = test_fixture.shared_violations(violations);
		expect(shared).toHaveLength(1);
		expect(shared[0].message).toContain('parameter type "list[Result]"');
	});

	test.each([
		[
			'TypeScript',
			{
				'two-groups.ts': [
					'class SharedInput {}',
					'class FirstService {',
					'  one(value: SharedInput) { return value; }',
					'  two(value: SharedInput) { return value; }',
					'  three(value: SharedInput) { return value; }',
					'  four(value: SharedInput) { return value; }',
					'}',
					'class SecondService {',
					'  one(value: SharedInput) { return value; }',
					'  two(value: SharedInput) { return value; }',
					'  three(value: SharedInput) { return value; }',
					'  four(value: SharedInput) { return value; }',
					'}',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'two_groups.py': [
					'class SharedInput:',
					'    pass',
					'',
					'class FirstService:',
					'    def one(self, value: SharedInput):',
					'        return value',
					'    def two(self, value: SharedInput):',
					'        return value',
					'    def three(self, value: SharedInput):',
					'        return value',
					'    def four(self, value: SharedInput):',
					'        return value',
					'',
					'class SecondService:',
					'    def one(self, value: SharedInput):',
					'        return value',
					'    def two(self, value: SharedInput):',
					'        return value',
					'    def three(self, value: SharedInput):',
					'        return value',
					'    def four(self, value: SharedInput):',
					'        return value',
				].join('\n'),
			},
		],
	])('reports two independent %s class groups', (_language, files) => {
		const test_fixture = new TestFixture();

		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({
			count: shared.length,
			different: shared[0].message !== shared[1].message,
			first: shared.map(item => item.message).join('\n').includes('FirstService.one'),
			second: shared.map(item => item.message).join('\n').includes('SecondService.one'),
		}).toEqual({ count: 2, different: true, first: true, second: true });
	});

	test.each([
		[
			'TypeScript',
			{
				'constructor.ts': [
					'class SharedInput {}',
					'class Service {',
					'  constructor(value: SharedInput) { void value; }',
					'  first(value: SharedInput) { return value; }',
					'  second(value: SharedInput) { return value; }',
					'  third(value: SharedInput) { return value; }',
					'}',
				].join('\n'),
			},
		],
		[
			'Python',
			{
				'constructor.py': [
					'class SharedInput:',
					'    pass',
					'',
					'class Service:',
					'    def __init__(self, value: SharedInput):',
					'        print(value)',
					'    def first(self, value: SharedInput):',
					'        return value',
					'    def second(self, value: SharedInput):',
					'        return value',
					'    def third(self, value: SharedInput):',
					'        return value',
				].join('\n'),
			},
		],
	])('keeps the %s constructor in its class method scope', (_language, files) => {
		const test_fixture = new TestFixture();

		const shared = test_fixture.shared_violations(test_fixture.collect_fixture_violations(files));

		expect({
			count: shared.length,
			service: shared[0].message.includes('Service.'),
			candidates: shared[0].message.includes('Candidates:'),
		}).toEqual({ count: 1, service: true, candidates: true });
	});

	test('does not combine Python production and test functions', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'production.py': [
				'class SharedInput:',
				'    pass',
				'',
				'def first(value: SharedInput):',
				'    return value',
				'',
				'def second(value: SharedInput):',
				'    return value',
			].join('\n'),
			'tests/shared_test.py': [
				'def fourth(value: SharedInput):',
				'    return value',
				'',
				'def fifth(value: SharedInput):',
				'    return value',
			].join('\n'),
		});

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test('ignores callables with missing typed-argument or usage metadata', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'missing.ts': [
				'function first(value) { return value; }',
				'function second(value: SharedInput) { return value; }',
			].join('\n'),
		});

		expect(test_fixture.shared_violations(violations)).toEqual([]);
	});

	test('keeps function diagnostics deterministic', () => {
		const test_fixture = new TestFixture();

		const reversed = Object.fromEntries(Object.entries(deterministic_function_files).reverse());
		const first = test_fixture.shared_violations(test_fixture.collect_fixture_violations(deterministic_function_files));
		const second = test_fixture.shared_violations(test_fixture.collect_fixture_violations(reversed));
		const first_prefix = first[0].file.slice(0, -'a.ts'.length);
		const second_prefix = second[0].file.slice(0, -'a.ts'.length);

		expect({
			first_count: first.length,
			second_count: second.length,
			deterministic: second[0].message.split(second_prefix).join('') === first[0].message.split(first_prefix).join(''),
		}).toEqual({
			first_count: 1,
			second_count: 1,
			deterministic: true,
		});
	});

	test('anchors function diagnostics to the first location', () => {
		const test_fixture = new TestFixture();
		const first = test_fixture.shared_violations(test_fixture.collect_fixture_violations(deterministic_function_files));

		expect({
			line: first[0].line,
			file: first[0].file.endsWith('a.ts'),
			candidate: first[0].message.includes('a.ts:2 first'),
			hint: first[0].hint.includes('a.ts:2 first'),
		}).toEqual({
			line: 2,
			file: true,
			candidate: true,
			hint: false,
		});
	});

	test('omits file names from method candidates but retains the violation location', () => {
		const test_fixture = new TestFixture();

		const methods = Array.from(
			{ length: 4 },
			(_, index) => `  method${index}(value: SharedInput) { return value; }`
		);
		const violations = test_fixture.collect_fixture_violations({
			'service.ts': ['class SharedInput {}', 'class Service {', ...methods, '}'].join('\n'),
		});
		const diagnostic = test_fixture.shared_violations(violations).find(item =>
			item.message.includes('multiple methods')
		);

		expect({
			line: diagnostic?.line,
			file: diagnostic?.file.endsWith('service.ts'),
			method: diagnostic?.message.includes('Service.method0'),
			file_in_message: diagnostic?.message.includes('service.ts:'),
		}).toEqual({ line: 3, file: true, method: true, file_in_message: false });
	});
});
