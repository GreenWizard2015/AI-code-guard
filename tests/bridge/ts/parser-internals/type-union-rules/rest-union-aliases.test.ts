import 'src/bridge/ts/parser-internals/type-union-rules/rest-union-contract';
import 'src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint rest union aliases', () => {
	test('resolves rest unions through nested namespace aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'namespaced-rest-union.ts': [
				'namespace ValueTypes {',
				'  export type CandidateValue = string | number;',
				'}',
				'function collect_named_namespace(...values: ValueTypes.CandidateValue[]): void {}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-rest-union-contract')).toHaveLength(1);
	});

	test('resolves rest unions through nested namespace chains', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-namespaced-rest-union.ts': [
				'namespace ValueTypes {',
				'  export namespace Nested {',
				'    export type CandidateValue = string | number;',
				'  }',
				'}',
				'function collect_nested(...values: ValueTypes.Nested.CandidateValue[]): void {}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-rest-union-contract')).toHaveLength(1);
	});
});
