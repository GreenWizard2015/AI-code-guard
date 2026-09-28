import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { describe, expect, test } from '@jest/globals';

import { TestFixture } from 'tests/core/test-fixture';


describe('factory alias architecture rules', () => {
	test('reports singleton factory results through array aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'array-factory-alias.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const [make] = [create_service];',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factory results through aliased arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'aliased-array-factory.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const factories = [create_service];',
				'const [make] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factory results through array spreads', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'spread-array-factory.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const factories = [...[create_service]];',
				'const [make] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factory results through spread objects', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'spread-factory-alias.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const factories = { ...{ create_service } };',
				'const { create_service: make } = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factory results through computed object keys', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'computed-key-factory.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				"const factories = { ['create_service']: create_service };",
				'const { create_service: make } = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton inline factories in object registries', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'inline-factory-alias.ts': [
				'class Service {}',
				'const factories = { create_service: () => new Service() };',
				'const { create_service: make } = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through parenthesized array elements', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parenthesized-array-factory.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const factories = [(create_service)];',
				'const [make] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through nested array destructuring', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-array-factory.ts': [
				'class Service {}',
				'function create_service(): Service { return new Service(); }',
				'const [[make]] = [[create_service]];',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports inline singleton factories through nested arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-inline-array-factory.ts': [
				'class Service {}',
				'const [[make]] = [[() => new Service()]];',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports inline singleton factories through nested objects', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nested-object-factory.ts': [
				'class Service {}',
				'const factories = { group: { make: () => new Service() } };',
				'const { group: { make } } = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports inline singleton factories through mixed arrays and objects', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'mixed-array-object-factory.ts': [
				'class Service {}',
				'const factories = [{ group: { make: () => new Service() } }];',
				'const [{ group: { make } }] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports inline singleton factories through aliased objects in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'aliased-object-array-factory.ts': [
				'class Service {}',
				'const group = { make: () => new Service() };',
				'const factories = [group];',
				'const [{ make }] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports inline singleton factories through array-object-array aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'array-object-array-factory.ts': [
				'class Service {}',
				'const factories = [{ group: { makers: [() => new Service()] } }];',
				'const [{ group: { makers: [make] } }] = factories;',
				'const service = make();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through shorthand object properties in arrays', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'shorthand-array-object-factory.ts': [
				'class Service {}',
				'function make(): Service { return new Service(); }',
				'const group = { make };',
				'const [{ make: extracted }] = [group];',
				'const service = extracted();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

});
