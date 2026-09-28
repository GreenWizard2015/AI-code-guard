import 'src/bridge/ts/rules/class-rules';
import 'src/bridge/ts/rules/naming-validation';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('coding-lint local type property resolution', () => {
	test('resolves required fields through local type aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'local-property-alias.ts': [
				'function candidate(): boolean {',
				'\ttype CandidateParsed = { value: string };',
				'\tconst candidate_parsed: CandidateParsed = { value: "" };',
				'\treturn candidate_parsed.value === undefined;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unnecessary-undefined-check')).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test('resolves required fields through local interfaces', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'local-property-interface.ts': [
				'function candidate(): boolean {',
				'\tinterface CandidateParsed { value: string; }',
				'\tconst candidate_parsed: CandidateParsed = { value: "" };',
				'\treturn candidate_parsed.value === undefined;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unnecessary-undefined-check')).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test('resolves required fields through namespace imported interfaces', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'model.ts': 'export interface Model { id: string; }',
			'consumer.ts': [
				"import * as Domain from './model';",
				'const model: Domain.Model = { id: "" };',
				'const invalid = model.id === undefined;',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unnecessary-undefined-check')).toEqual([
			expect.objectContaining({ line: 3 }),
		]);
	});

	test('resolves required fields through value aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'object-alias.ts': [
				'interface Model { id: string; }',
				'const model: Model = { id: "" };',
				'const alias = model;',
				'const invalid = alias.id === undefined;',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unnecessary-undefined-check')).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});
});
