import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
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
				'    (expect)(true).toBe(true);',
				'    const check = expect;',
				'    check(true).toBe(true);',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-expect')).toHaveLength(0);
	});

	test('applies Jest rules to spec files', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/spec-file.spec.ts': [
				"describe('spec file', () => {",
				"  test('only case', () => { expect(true).toBe(true); });",
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-min-count')).toHaveLength(1);
	});

	test('applies Jest rules to modifier calls', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/modifiers.test.ts': [
				"describe.only('suite', () => {",
				...Array.from({ length: 16 }, (_, index) => `  test.only('case ${index}', () => { expect(true).toBe(true); });`),
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-max-count')).toHaveLength(1);
	});

	test('rejects an expect assertion inside a Jest test condition', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/conditional-expect.test.ts': "describe('condition', () => { test('result', () => { expect(true).toBe(true); if (true) { expect(false).toBe(false); } }); });",
		});
		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-ending')).toHaveLength(1);
	});

	test('rejects an expect alias before test cleanup', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/expect-alias-ending.test.ts': [
				"describe('suite', () => {",
				"  test('case', () => {",
				'    const check = expect;',
				'    check(1).toBe(1);',
				'    do_cleanup();',
				'  });',
				"  test('second', () => { expect(1).toBe(1); });",
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-ending')).toHaveLength(1);
	});

	test('rejects a parenthesized expect before test cleanup', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/parenthesized-expect-ending.test.ts': [
				"describe('suite', () => {",
				"  test('case', () => {",
				'    (expect)(1).toBe(1);',
				'    do_cleanup();',
				'  });',
				"  test('second', () => { expect(1).toBe(1); });",
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-ending')).toHaveLength(1);
	});

	test('rejects parenthesized nested describe calls', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/parenthesized-describe.test.ts': [
				"describe('root', () => {",
				"  (describe)('nested', () => {",
				"    test('value', () => { expect(true).toBe(true); });",
				'  });',
				'  const nested_alias = describe;',
				"  nested_alias('nested alias', () => { test('alias value', () => { expect(true).toBe(true); }); });",
				'});',
			].join('\n'),
		});
		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-nested-describe')).toHaveLength(2);
	});

	test('rejects Jest test aliases without expect assertions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/test-alias.test.ts': [
				"describe('suite', () => {",
				'  const check = test;',
				"  check('one', () => { const value_only = value; });",
				'});',
			].join('\n'),
		});
		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-expect')).toHaveLength(1);
	});
});
