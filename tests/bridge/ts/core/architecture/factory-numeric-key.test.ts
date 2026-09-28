import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { describe, expect, test } from '@jest/globals';

import { TestFixture } from 'tests/core/test-fixture';

describe('static factory object keys', () => {
	test('reports singleton factories through computed object properties in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'computed-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				"const group = { ['make']: make };",
				'const [{ make: extracted }] = [group];',
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});
	test('reports singleton factories through numeric object properties in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'numeric-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				'const group = { 0: make };',
				'const [{ 0: extracted }] = [group];',
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through computed numeric properties in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'computed-numeric-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				'const group = { [0]: make };',
				'const [{ 0: extracted }] = [group];',
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through computed binding properties in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'computed-binding-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				'const group = { make };',
				"const [{ ['make']: extracted }] = [group];",
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through nested computed binding properties', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-computed-binding-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				'const group = { group: { make } };',
				"const [{ group: { ['make']: extracted } }] = [group];",
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});
});
