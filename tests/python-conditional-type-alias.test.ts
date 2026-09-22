import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python conditional type aliases', () => {
	test('rejects conditional annotations without depending on names', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if runtime_mode:',
				'    FirstValue: Alias = Request | Cache',
				'else:',
				'    RuntimeValue: Alias = Request',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('allows branches without annotated assignments', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if runtime_mode:',
				'    value = load_value()',
				'else:',
				'    value = fallback_value()',
		].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(0);
	});

	test('allows a typed runtime value in one branch', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    value: FirstType = first_value',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(0);
	});

	test('rejects a name alias in the if branch', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    ResultType: AliasMarker = RuntimeType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('rejects an attribute alias in the else branch', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    value = load_value()',
				'else:',
				'    ResultType: AliasMarker = package.RuntimeType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('rejects a subscript alias', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    ResultType: AliasMarker = list[RuntimeType]',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('rejects both union and intersection aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    UnionType: AliasMarker = FirstType | SecondType',
				'    IntersectionType: AliasMarker = FirstType & SecondType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('rejects an alias in an elif branch', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if first_mode:',
				'    value = load_value()',
				'elif second_mode:',
				'    ResultType: AliasMarker = RuntimeType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('rejects an alias in a nested condition', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if outer_mode:',
				'    if inner_mode:',
				'        ResultType: AliasMarker = RuntimeType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(1);
	});

	test('allows an annotation without an assigned value', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    ResultType: AliasMarker',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(0);
	});

	test('allows a lower-case typed value with a type-shaped result', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'types.py': [
				'if enabled:',
				'    result_type: AliasMarker = RuntimeType',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-conditional-type-alias')).toHaveLength(0);
	});
});
