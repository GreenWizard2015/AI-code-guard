import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint tuple types', () => {
	const test_fixture = new TestFixture();

	test('rejects readonly tuple contracts', () => {
		const violations = test_fixture.collect_fixture_violations({
			'result.ts': 'export type Result = readonly [file: string, name: string];',
		});
		expect(violations.filter(item => item.rule_id === 'tuple-type')).toHaveLength(1);
	});

	test('rejects positional tuple contracts', () => {
		const violations = test_fixture.collect_fixture_violations({
			'result.ts': 'export type Result = [string, number];',
		});
		expect(violations.filter(item => item.rule_id === 'tuple-type')).toHaveLength(1);
	});

	test('allows named result contracts', () => {
		const violations = test_fixture.collect_fixture_violations({
			'result.ts': 'export interface Result { file: string; name: string; }',
		});
		expect(violations.filter(item => item.rule_id === 'tuple-type')).toHaveLength(0);
	});

	test('rejects Python tuple contracts', () => {
		const violations = test_fixture.collect_fixture_violations({
			'result.py': 'def resolve() -> tuple[str, int]:\n    return "file", 1\n',
		});
		expect(violations.filter(item => item.rule_id === 'tuple-type')).toHaveLength(1);
	});
});
