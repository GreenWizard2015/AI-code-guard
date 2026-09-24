import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { typescript_usage_files, python_usage_files } from 'tests/core/constants';

describe('coding-lint callable usage rule', () => {
	const test_fixture = new TestFixture();
	test('reports TypeScript functions and methods with no external production callers', () => {
		const violations = test_fixture.collect_fixture_violations(typescript_usage_files);
		const existing_rule_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		const messages = existing_rule_violations.map(violation => violation.message);
		expect({
			once: messages.includes('function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			test_only: messages.includes('function "testOnly" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'),
			service_once: messages.includes('method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			private_function: messages.some(message => message.includes('function "_privateFunction" is used')),
			private_method: messages.some(message => message.includes('method "Service.privateOnce" is used')),
			twice: messages.some(message => message.includes('function "twice" is used')),
			service_twice: messages.some(message => message.includes('method "Service.twice" is used')),
			info_only: existing_rule_violations.some(violation => violation.message.includes('function "once"') && violation.priority !== 1),
		}).toEqual({
			once: false, test_only: true, service_once: false, private_function: false,
			private_method: false, twice: false, service_twice: false, info_only: false,
		});
	});
	test('applies the same rule to Python functions and methods', () => {
		const violations = test_fixture.collect_fixture_violations(python_usage_files);

		const existing_rule_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		const messages = existing_rule_violations.map(violation => violation.message);
		expect({
			once: messages.includes('function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			service_once: messages.includes('method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			local_only: messages.some(message => message.includes('function "local_only"')),
			private_function: messages.some(message => message.includes('function "_private_function" is used')),
			private_method: messages.some(message => message.includes('method "Service._private_method" is used')),
			twice: messages.some(message => message.includes('function "twice" is used')),
			service_twice: messages.some(message => message.includes('method "Service.twice" is used')),
		}).toEqual({
			once: false, service_once: false, local_only: false, private_function: false,
			private_method: false, twice: false, service_twice: false,
		});
	});
	test('does not count methods called only from tests', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['class Service {', '  test_only() { return 1; }', '}'].join('\n'),
			'tests/usage.ts': ["import { Service } from '../source';", 'new Service().test_only();'].join(
				'\n'
			),
		});

		expect(
			violations.some(
				violation =>
					violation.message ===
					'method "Service.test_only" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
			)
		).toBe(true);
	});
	test('counts bound methods as production usage', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Service {', '  once() { return 1; }', '}'].join('\n'),
			'one.ts': [
				"import { Service } from './source';",
				'const service = new Service();',
				'const callback = service.once.bind(service);',
			].join('\n'),
			'two.ts': [
				"import { Service } from './source';",
				'const service = new Service();',
				'const callback = service.once.bind(service);',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.once" is used'))
		).toBe(false);
	});
	test('does not treat a method call with a satisfies object as Function.bind', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export interface Actions { onMoreRequested: () => void; }',
				'export class Service {',
				'  bind(actions: Actions): void {}',
				'}',
			].join('\n'),
			'caller.ts': [
				"import { Actions, Service } from './source';",
				'function bind_actions(view: Service): void {',
				'  view.bind({ onMoreRequested: () => undefined } satisfies Actions);',
				'}',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.bind" is used'))
		).toBe(false);
	});
	test('counts methods bound from object-literal instance containers', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Service {', '  once() { return 1; }', '}'].join('\n'),
			'one.ts': [
				"import { Service } from './source';",
				'const waiters = { current: new Service() };',
				'const callback = waiters.current.once.bind(waiters.current);',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.once" is used'))
		).toBe(false);
	});
	test('resolves bound methods from object-literal identifier containers', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Service {', '  once() { return 1; }', '}'].join('\n'),
			'one.ts': [
				"import { Service } from './source';",
				'const service = new Service();',
				'const waiters = { current: service };',
				'const callback = waiters.current.once.bind(waiters.current);',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.once" is used'))
		).toBe(false);
	});
	test('resolves methods through typed getters', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Service {', '  once() {}', '}'].join('\n'),
			'caller.ts': [
				"import { Service } from './source';",
				'class Container {',
				'  get service(): Service { return new Service(); }',
				'  run(): void { this.service.once(); }',
				'}',
				'new Container().run();',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.once" is used'))
		).toBe(false);
	});
	test('resolves methods through typed object parameters', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Service {', '  once() { return 1; }', '}'].join('\n'),
			'caller.ts': [
				"import { Service } from './source';",
				'type Parts = { service: Service };',
				'function attach(parts: Parts): void {',
				'  parts.service.once();',
				'}',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Service.once" is used'))
		).toBe(false);
	});
});
