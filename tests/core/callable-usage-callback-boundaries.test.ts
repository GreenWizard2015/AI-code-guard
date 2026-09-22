import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { python_framework_hook_files } from 'tests/core/constants';


describe('coding-lint callable usage advanced - callback boundaries', () => {
	test('resolves methods called through local structural method aliases', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export class Resolver {',
				'  resolve(value: string) { return value; }',
				'}',
				'type ResolverLike = { resolve(value: string): string; };',
				'class OtherResolver {',
				'  resolve(value: string) { return value; }',
				'}',
				'class Consumer {',
				'  resolver(): ResolverLike { return new Resolver(); }',
				"  use() { return this.resolver().resolve('value'); }",
				'}',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Resolver.resolve" is used'))
		).toBe(false);
	});

	test('resolves methods called through imported function return properties', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'collector.ts': ['export class Collector {', '  collect() { return []; }', '}'].join('\n'),
			'context.ts': [
				"import { Collector } from './collector';",
				'export type Context = { collector: Collector };',
				'export function resolve_context(): Context | null {',
				'  return { collector: new Collector() };',
				'}',
			].join('\n'),
			'consumer.ts': [
				"import { resolve_context } from './context';",
				'export function consume(): unknown[] {',
				'  const context = resolve_context();',
				'  if (!context) return [];',
				'  return context.collector.collect();',
				'}',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				violation.message.includes('method "Collector.collect" has insufficient production usage (found 0')
			)
		).toBe(false);
	});

	test('counts functions registered as tool callbacks', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export function registered_handler() { return 1; }',
				'export function registered_execute() { return 2; }',
			].join('\n'),
			'registry.ts': [
				"import { registered_execute, registered_handler } from './source';",
				'const tools = {',
				'  handler: registered_handler,',
				'  execute: registered_execute,',
				'};',
				'const callbacks = [registered_handler, registered_execute];',
				'register_tool(registered_handler);',
				'const fallback = registered_handler ?? registered_execute;',
				'function create_factory() { return registered_handler; }',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				/function "registered_(handler|execute)" has insufficient production usage \(found 0/.test(violation.message)
			)
		).toBe(false);
	});

	test('counts functions used as default callback parameters', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': 'function wait_for_title() { return Promise.resolve(); }',
			'one.ts': [
				"import { wait_for_title } from './source';",
				'function create_flow(wait = wait_for_title) { return wait; }',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('function "wait_for_title" is used'))
		).toBe(false);
	});

	test('does not confuse domain bind methods with Function.bind', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'class View {',
				'  bind(actions: object) { return actions; }',
				'}',
				'const view = new View();',
				'view.bind({});',
			].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "View.bind" has insufficient production usage (found 0'))
		).toBe(false);
	});

	test('ignores Python properties but checks framework hooks', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(python_framework_hook_files);
		expect({
			property: violations.some(violation => violation.message.includes('method "Handler.value"')),
			cached: violations.some(violation => violation.message.includes('method "Handler.cached"')),
			hook: violations.some(violation => violation.message.includes('method "Handler.do_GET"')),
		}).toEqual({ property: false, cached: false, hook: true });
	});

	test('counts Python methods registered in callback containers', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.py': [
				'class Dispatcher:',
				'    def handle_register(self):',
				'        return None',
				'',
				'    def handle_unregister(self):',
				'        return None',
				'',
				'    def routes(self):',
				'        return {"register": self.handle_register, "unregister": self.handle_unregister}',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				violation.message.includes('method "Dispatcher.handle_register" has insufficient production usage (found 0')
			)
		).toBe(false);
		expect(
			violations.some(violation =>
				violation.message.includes('method "Dispatcher.handle_unregister" has insufficient production usage (found 0')
			)
		).toBe(false);
	});
});
