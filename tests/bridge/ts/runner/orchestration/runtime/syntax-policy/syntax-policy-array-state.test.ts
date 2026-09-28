import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('coding-lint syntax policy - array state', () => {
	test('rejects single-item access through non-null call aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'non-null-array-alias.ts': [
				'function values(): string[] { return ["value"]; }',
				'const get_values = values!;',
				'const candidate = get_values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item at access through non-null call aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'non-null-at-alias.ts': [
				'function values(): string[] { return ["value"]; }',
				'const get_values = values!;',
				'const candidate = get_values().at(0);',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects zero-index access through parenthesized call aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parenthesized-array-alias.ts': [
				'function values(): string[] { return ["value"]; }',
				'const get_values = (values);',
				'const candidate = get_values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item access through array type aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'type-alias-array.ts': [
				'type Values = string[];',
				'function values(): Values { return ["value"]; }',
				'const candidate = values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item access through readonly array return types', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'readonly-array.ts': [
				'function get_items(): readonly string[] {',
				"  return ['item'];",
				'}',
				'const first_item = get_items()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item access through readonly type aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'readonly-type-alias.ts': [
				'type InnerValues = readonly string[];',
				'type Values = InnerValues;',
				'type GenericValues = Readonly<string[]>;',
				'function values(): Values { return ["value"]; }',
				'function generic_values(): GenericValues { return ["value"]; }',
				'const first_value = values()[0];',
				'const first_generic_value = generic_values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(2);
	});

	test('rejects readonly aliases of array aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-readonly-type-alias.ts': [
				'type Items = Array<string>;',
				'type Values = Readonly<Items>;',
				'function values(): Values { return ["value"]; }',
				'const first_value = values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item at access through generic array aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'type-alias-generic-array.ts': [
				'type Values = ReadonlyArray<string>;',
				'function values(): Values { return ["value"]; }',
				'const candidate = values().at(0);',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});

	test('rejects single-item access through qualified array aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'qualified-type-alias-array.ts': [
				'namespace Domain { export type Values = string[]; }',
				'function values(): Domain.Values { return ["value"]; }',
				'const candidate = values()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(1);
	});
});
