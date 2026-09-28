import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint object literal aliases', () => {
	test('reports object returns through direct contract aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'type Candidate = Contract;',
				'function create(): Candidate { return { run() {} }; }',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});

	test('reports object returns through mixed transparent wrappers', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create(): Contract {',
				'  return (({ run() {} } as Contract)! as Contract);',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});

	test('reports object returns through namespace contract aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'namespace Local {',
				'  export type Candidate = Contract;',
				'}',
				'function create(): Local.Candidate { return { run() {} }; }',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});

	test('reports object returns through nested namespace aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'namespace Local {',
				'  export namespace Nested {',
				'    export type Candidate = Contract;',
				'  }',
				'}',
				'function create(): Local.Nested.Candidate { return { run() {} }; }',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});
});
