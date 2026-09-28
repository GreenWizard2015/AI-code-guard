import 'src/bridge/ts/parser-internals/typescript-node-rules';
import 'src/bridge/ts/parser-internals/typescript-structural-rules';
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

	test('rejects Python tuple aliases', () => {
		const violations = test_fixture.collect_fixture_violations({
			'result.py': [
				'from typing import Tuple',
				'TupleAlias = Tuple',
				'def resolve(value: TupleAlias[str, int]) -> TupleAlias[str, int]:',
				'    return value',
				'TupleDestructured, ignored = (Tuple, None)',
				'def resolve_destructured(value: TupleDestructured[str, int]) -> TupleDestructured[str, int]:',
				'    return value',
				'TupleStar, *ignored = (Tuple, None, None)',
				'def resolve_star(value: TupleStar[str, int]) -> TupleStar[str, int]:',
				'    return value',
			].join('\n'),
		});
		expect(violations.filter(item => item.rule_id === 'tuple-type')).toHaveLength(6);
	});
});
