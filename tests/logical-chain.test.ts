import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint logical chain rules', () => {
	test('requires a named condition for more than three parts', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': 'function ready(a: boolean, b: boolean, c: boolean, d: boolean): boolean { return a && b && c && d; }',
			'conditions.py': 'def ready(a: bool, b: bool, c: bool, d: bool) -> bool:\n    return a and b and c and d',
		});

		expect(violations.filter(item => item.rule_id === 'logical-chain-size')).toHaveLength(2);
	});

	test('requires a named condition when a three-part expression is 100+ characters', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': 'function ready(request: Request): boolean { return request.user.permission_names_that_are_loaded_from_the_remote_permission_registry && request.user.is_active && request.user.is_verified; }',
			'conditions.py': 'def ready(request: Request) -> bool:\n    return request.user.permission_names_that_are_loaded_from_the_remote_permission_registry and request.user.is_active and request.user.is_verified',
		});

		expect(violations.filter(item => item.rule_id === 'logical-chain-size')).toHaveLength(2);
	});

	test('allows a long chain inside a named variable', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': 'function ready(a: boolean, b: boolean, c: boolean, d: boolean): boolean { const is_ready = a && b && c && d; return is_ready; }',
			'conditions.py': 'def ready(a: bool, b: bool, c: bool, d: bool) -> bool:\n    is_ready = a and b and c and d\n    return is_ready',
		});

		expect(violations.filter(item => item.rule_id === 'logical-chain-size')).toHaveLength(0);
	});

	test('requires a named condition for 100+ character two-part chains but ignores one part', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': [
				'function two(request: Request): boolean { return request.user.permission_names_that_are_loaded_from_the_remote_permission_registry && request.user.is_active; }',
				'function one(request: Request): boolean { return request.user.is_a_very_long_boolean_property_name_that_is_still_one_part; }',
			].join('\n'),
			'conditions.py': [
				'def two(request: Request) -> bool:',
				'    return request.user.permission_names_that_are_loaded_from_the_remote_permission_registry and request.user.is_active',
				'',
				'def one(request: Request) -> bool:',
				'    return request.user.is_a_very_long_boolean_property_name_that_is_still_one_part',
			].join('\n'),
		});

		const logical_violations = violations.filter(item => item.rule_id === 'logical-chain-size');
		expect({
			typescript: logical_violations.filter(item => item.file.endsWith('conditions.ts')).length,
			python: logical_violations.filter(item => item.file.endsWith('conditions.py')).length,
		}).toEqual({ typescript: 1, python: 1 });
	});

	test('counts only the logical expression, not its surrounding function', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': [
				'function ready(a: boolean, b: boolean, third_parameter_with_a_descriptive_name: string, fourth_parameter_with_a_descriptive_name: string): boolean {',
				'\treturn a && b;',
				'}',
			].join('\n'),
			'conditions.py': [
				'def ready(a: bool, b: bool, third_parameter_with_a_descriptive_name: str, fourth_parameter_with_a_descriptive_name: str) -> bool:',
				'    return a and b',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'logical-chain-size')).toHaveLength(0);
	});
});
