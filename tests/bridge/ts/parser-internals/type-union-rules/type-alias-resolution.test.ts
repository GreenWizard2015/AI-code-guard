import 'src/bridge/ts/parser-internals/type-union-rules/rest-union-contract';
import 'src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('TypeScript type alias resolution', () => {
	test('reports unbounded aliases declared inside callables', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'unbounded-local-alias.ts': [
				'function control(value: any): string {',
				'  return "";',
				'}',
				'',
				'function candidate(): void {',
				'  type Hidden = any;',
				'  function inner(value: Hidden): string {',
				'    return "";',
				'  }',
				'  inner(1);',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unbounded-type')).toHaveLength(2);
	});

	test('reports unbounded aliases declared inside namespaces', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'unbounded-namespace-alias.ts': [
				'namespace Scope {',
				'  type Hidden = unknown;',
				'  function read(value: Hidden): string { return ""; }',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unbounded-type')).toHaveLength(2);
	});
});
