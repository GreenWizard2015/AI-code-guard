import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { describe, expect, test } from '@jest/globals';

import { TestFixture } from 'tests/core/test-fixture';

describe('singleton alias architecture rules', () => {
	test('reports singleton constructors through parenthesized aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parenthesized-alias.ts': [
				'class Service { public run(): void {} }',
				'const service_class = (Service);',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through type assertions', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'type-assertion-instance.ts': [
				'class Service { public run(): void {} }',
				'const service = new (Service as typeof Service)();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through mixed type wrappers', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'mixed-type-wrapper-instance.ts': [
				'class Service { public run(): void {} }',
				'const service = new (Service! as typeof Service)();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through non-null aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'non-null-alias.ts': [
				'class Service { public run(): void {} }',
				'const service_class = Service!;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through object source aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'object-source-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = { service_class: Service };',
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton factories through object properties', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'object-factory-property.ts': [
				'class Service { public run(): void {} }',
				'const factories = { create: (): Service => new Service() };',
				'const service = factories.create();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through array source aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'array-source-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = [Service];',
				'const [service_class] = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through wrapped array elements', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'wrapped-array-element.ts': [
				'class Service { public run(): void {} }',
				'const constructors = [(Service)];',
				'const [service_class] = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});
});
