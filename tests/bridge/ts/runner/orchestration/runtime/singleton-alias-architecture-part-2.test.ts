import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { describe, expect, test } from '@jest/globals';

import { TestFixture } from 'tests/core/test-fixture';

describe('singleton alias architecture rules', () => {
	test('reports singleton constructors through spread object aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'spread-object-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = { ...{ service_class: Service } };',
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('resolves the final property in spread object aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'spread-override-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = { service_class: Object, ...{ service_class: Service } };',
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through quoted object keys', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'quoted-object-alias.ts': [
				'class Service { public run(): void {} }',
				"const constructors = { 'service_class': Service };",
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through wrapped object values', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'wrapped-object-value.ts': [
				'class Service { public run(): void {} }',
				'const constructors = { service_class: (Service) };',
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through namespace object values', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'namespace-object-value.ts': [
				"import * as service_module from './service';",
				'class Service { public run(): void {} }',
				'const constructors = { service_class: service_module.Service };',
				'const { service_class } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through namespace element access', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'service.ts': 'export class Service {}',
			'consumer.ts': [
				"import * as Domain from './service';",
				"const service = new Domain['Service']();",
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through quoted renamed keys', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'quoted-renamed-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = { service_class: Service };',
				"const { 'service_class': selected_class } = constructors;",
				'const service = new selected_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports singleton constructors through destructuring defaults', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'destructuring-default-alias.ts': [
				'class Service { public run(): void {} }',
				'const constructors = {};',
				'const { service_class = Service } = constructors;',
				'const service = new service_class();',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});
});
