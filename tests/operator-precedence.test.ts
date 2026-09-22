import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

	describe('coding-lint operator precedence rules', () => {
	test('requires grouping for mixed boolean and arithmetic operators', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'operators.ts': [
				'const mixed_boolean = first && second || third;',
				'const mixed_arithmetic = first + second / third;',
				'const grouped_boolean = first && (second || third);',
				'const grouped_arithmetic = first + (second / third);',
			].join('\n'),
			'operators.py': [
				'mixed_boolean = first and second or third',
				'mixed_arithmetic = first + second / third',
				'grouped_boolean = first and (second or third)',
				'grouped_arithmetic = first + (second / third)',
			].join('\n'),
		});
		const boolean_violations = violations.filter(item => item.rule_id === 'mixed-boolean-precedence');
		const arithmetic_violations = violations.filter(item => item.rule_id === 'mixed-arithmetic-precedence');

		expect({
			boolean_count: boolean_violations.length,
			arithmetic_count: arithmetic_violations.length,
		}).toEqual({ boolean_count: 2, arithmetic_count: 2 });
	});

	test('counts logical parts inside parentheses', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'logical.ts': 'function ready(first: boolean, second: boolean, third: boolean, fourth: boolean): boolean { return first || (second && third) || fourth; }',
			'logical.py': 'def ready(first: bool, second: bool, third: bool, fourth: bool) -> bool:\n    return first or (second and third) or fourth',
		});
		const logical = violations.filter(item => item.rule_id === 'logical-chain-size');

		expect({
			count: logical.length,
			typescript: logical.some(item => item.file.endsWith('logical.ts')),
			python: logical.some(item => item.file.endsWith('logical.py')),
		}).toEqual({ count: 2, typescript: true, python: true });
	});
});
