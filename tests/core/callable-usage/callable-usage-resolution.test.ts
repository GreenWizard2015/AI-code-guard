import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { local_callable_files, local_python_callable_files, protocol_container_files, type_checking_property_files, forward_annotation_files } from 'tests/core/constants';

describe('coding-lint callable usage rule', () => {
	const test_fixture = new TestFixture();
	test('does not report a callable used only in its defining file', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'function localOnly() { return 1; }',
				'function caller() { return localOnly(); }',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).not.toContain(
			'function "localOnly" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
	});
	test('does not report callables used only inside their defining file', () => {

		const typescriptViolations = test_fixture.collect_fixture_violations(local_callable_files);
		const pythonViolations = test_fixture.collect_fixture_violations(local_python_callable_files);
		expect({
			ts_helper: typescriptViolations.some(violation => violation.message.includes('method "Service.helper" has insufficient production usage (found 0 other production files')),
			ts_hidden: typescriptViolations.some(violation => violation.message.includes('Service.hidden')),
			python_helper: pythonViolations.some(violation => violation.message.includes('method "Service.helper" has insufficient production usage (found 0 other production files')),
			python_hidden: pythonViolations.some(violation => violation.message.includes('Service._hidden')),
		}).toEqual({ ts_helper: false, ts_hidden: false, python_helper: false, python_hidden: false });
	});
	test('does not report interface method signatures as callable usage', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'interface ServicePort {',
				'  execute(value: string): Promise<void>;',
				'}',
				'class Service implements ServicePort {',
				'  execute(value: string): Promise<void> {',
				'    return Promise.resolve();',
				'  }',
				'}',
			].join('\n'),
		});

		expect(violations.some(violation => violation.message.includes('ServicePort.execute'))).toBe(
			false
		);
	});
	test('resolves concrete methods behind typed Python protocol containers', () => {

		const violations = test_fixture.collect_fixture_violations(protocol_container_files);

		const messages = violations.map(violation => violation.message);
		expect({
			matches_used: messages.includes('method "ConcreteHandler.matches" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			handle_used: messages.includes('method "ConcreteHandler.handle" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			matches_unused: messages.includes('method "ConcreteHandler.matches" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'),
			handle_unused: messages.includes('method "ConcreteHandler.handle" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'),
		}).toEqual({ matches_used: false, handle_used: false, matches_unused: false, handle_unused: false });
	});
	test('resolves Python properties declared under TYPE_CHECKING', () => {

		const violations = test_fixture.collect_fixture_violations(type_checking_property_files);

		const messages = violations.map(violation => violation.message);
		expect(messages).not.toContain(
			'method "BrowserBridgeDirectory.has_tool" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'
		);
		expect(messages).not.toContain(
			'method "BrowserBridgeDirectory.has_tool" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
	});
	test('resolves methods on objects returned by local method calls', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class Observer {', '  observe() {}', '}'].join('\n'),
			'caller.ts': [
				"import { Observer } from './source';",
				'class Coordinator {',
				'  create_observer(): Observer {',
				'    return new Observer();',
				'  }',
				'  run() {',
				'    this.create_observer().observe();',
				'  }',
				'}',
			].join('\n'),
		});

		const messages = violations.map(violation => violation.message);
		expect(messages).not.toContain(
			'method "Observer.observe" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'
		);
		expect(messages).not.toContain(
			'method "Observer.observe" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
	});
	test('resolves methods through nullable typed parameters', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export class InputElement {',
				'  private readonly element = document.body;',
				'  raw() { return this.element; }',
				'}',
				'export function exclude(input: InputElement | null): HTMLElement | null {',
				'  return input ? input.raw() : null;',
				'}',
			].join('\n'),
			'one.ts': ["import { exclude } from './source';", 'exclude(null);'].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "InputElement.raw"'))
		).toBe(false);
	});
	test('resolves methods on class properties initialized by typed factories', () => {

		const violations = test_fixture.collect_fixture_violations({
			'cron.ts': [
				'export class Cron {',
				'  stop() { return undefined; }',
				'}',
				'export function create_cron(): Cron { return new Cron(); }',
			].join('\n'),
			'controller.ts': [
				"import { create_cron } from './cron';",
				'export class Controller {',
				'  private readonly cron: Cron = create_cron();',
				'  run() { this.cron.stop(); }',
				'}',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).not.toContain(
			'method "Cron.stop" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
	});
	test('resolves Python methods through forward annotations and local factory returns', () => {

		const violations = test_fixture.collect_fixture_violations(forward_annotation_files);

		const messages = violations.map(violation => violation.message);
		expect(messages).not.toContain(
			'method "BrowserBridgeTransport.poll" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
		expect(messages).not.toContain(
			'method "Client.initialize" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
	});
});
