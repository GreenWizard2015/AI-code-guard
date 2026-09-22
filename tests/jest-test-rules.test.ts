import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('Jest test rules', () => {
	test('requires Jest expect to be a direct test statement', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/nested-expect.test.ts': [
				"describe('nested expect', () => {",
				"  test('nested assertion', () => {",
				'    run(() => { expect(true).toBe(true); });',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-expect')).toHaveLength(1);
	});

	test('accepts an expect assertion directly in the Jest test callback', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/direct-expect.test.ts': [
				"describe('direct expect', () => {",
				"  test('direct assertion', () => {",
				'    expect(true).toBe(true);',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-expect')).toHaveLength(0);
	});

	test('rejects an expect assertion inside a Jest test condition', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/conditional-expect.test.ts': "describe('condition', () => { test('result', () => { expect(true).toBe(true); if (true) { expect(false).toBe(false); } }); });",
		});
		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-ending')).toHaveLength(1);
	});
});
