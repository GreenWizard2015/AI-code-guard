import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { interface_port_files, export_usage_files, awaited_return_files } from 'tests/core/constants';

describe('coding-lint callable usage resolution - class boundaries', () => {
	const test_fixture = new TestFixture();
	test('resolves methods shared by mixins through their concrete subclass', () => {

		const violations = test_fixture.collect_fixture_violations({
			'target.py': [
				'class TargetMixin:',
				'    def resolve_target(self):',
				'        return None',
			].join('\n'),
			'caller.py': [
				'class CallMixin:',
				'    def call(self):',
				'        return self.resolve_target()',
			].join('\n'),
			'client.py': [
				'from caller import CallMixin',
				'from target import TargetMixin',
				'class Client(CallMixin, TargetMixin):',
				'    pass',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				violation.message.includes('method "TargetMixin.resolve_target" has insufficient production usage (found 0')
			)
		).toBe(false);
	});
	test('resolves instantiated class owners for duplicate method names', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export class First {',
				'  once() { return 1; }',
				'}',
				'export class Second {',
				'  once() { return 2; }',
				'}',
			].join('\n'),
			'one.ts': [
				"import { First } from './source';",
				'const first = new First();',
				'first.once();',
				'new First().once();',
			].join('\n'),
			'two.ts': [
				"import { First } from './source';",
				'const first = new First();',
				'first.once();',
				'new First().once();',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "First.once" is used'))
		).toBe(false);
	});
	test('resolves interface ports and default injected instances', () => {

		const violations = test_fixture.collect_fixture_violations(interface_port_files);

		expect({
			effects: violations.some(violation => violation.message.includes('method "Effects.click"')),
			waiter: violations.some(violation => violation.message.includes('method "Waiter.wait"')),
			effects_zero: violations.some(violation => violation.message.includes('method "Effects.click" has insufficient production usage (found 0')),
			waiter_zero: violations.some(violation => violation.message.includes('method "Waiter.wait" has insufficient production usage (found 0')),
		}).toEqual({ effects: false, waiter: false, effects_zero: false, waiter_zero: false });
	});
	test('tracks method calls through fluent instance aliases', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export class Merger {',
				'  add_all(): this { return this; }',
				'  build() { return {}; }',
				'}',
			].join('\n'),
			'one.ts': [
				"import { Merger } from './source';",
				'const merger = new Merger();',
				'const configured = merger.add_all();',
				'configured.build();',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).not.toContain(
			'method "Merger.build" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'
		);
	});
	test('does not use exports as callable usage exemptions', () => {

		const typescriptViolations = test_fixture.collect_fixture_violations(export_usage_files.typescript);
		const pythonViolations = test_fixture.collect_fixture_violations(export_usage_files.python);
		expect(typescriptViolations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'function "public_function" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
				'method "PublicService.run" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			])
		);
		expect(pythonViolations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'function "public_function" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
				'method "PublicService.run" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			])
		);
	});
	test('resolves awaited imported return types without mixing same-named methods', () => {

		const violations = test_fixture.collect_fixture_violations(awaited_return_files);

		const messages = violations.map(violation => violation.message);
		expect({
			raw_used: messages.includes('method "DomElement.raw" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			text_unused: messages.includes('method "DomElement.text" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'),
			text_used: messages.includes('method "DomElement.text" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
			other_used: messages.includes('method "OtherElement.text" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'),
		}).toEqual({ raw_used: false, text_unused: true, text_used: false, other_used: false });
	});
	test('does not match dynamic Python calls to same-named TypeScript methods', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': ['export class DomElement {', '  text() {}', '}'].join('\n'),
			'page.py': ['class Page:', '    def text(self):', '        return ""'].join('\n'),
			'caller.py': [
				'from page import Page',
				'',
				'def read_page(page: Page):',
				'    return page.text()',
			].join('\n'),
		});

		const messages = violations.map(violation => violation.message);
		expect(messages).toContain(
			'method "DomElement.text" has insufficient production usage (found 0 other production files; candidate for removal/refactor)'
		);
		expect(messages).not.toContain(
			'method "DomElement.text" has insufficient production usage (found 1 other production file; candidate for removal/refactor)'
		);
	});
	test('resolves protocol methods through typed container fields', () => {

		const violations = test_fixture.collect_fixture_violations({
			'source.py': [
				'from typing import Protocol',
				'class RequestHandler(Protocol):',
				'    def handle(self, request): ...',
				'class ConcreteHandler:',
				'    def handle(self, request):',
				'        return None',
			].join('\n'),
			'dispatcher.py': [
				'from source import ConcreteHandler, RequestHandler',
				'class Dispatcher:',
				'    def __init__(self, handlers: tuple[RequestHandler, ...]):',
				'        self.handlers = handlers',
				'    def dispatch(self, request):',
				'        for handler in self.handlers:',
				'            handler.handle(request)',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "ConcreteHandler.handle"'))
		).toBe(false);
	});
});
