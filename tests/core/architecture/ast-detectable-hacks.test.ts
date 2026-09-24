import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('AST-detectable implementation hacks', () => {
	test('detects callable object literals', () => {
		const fixture = new TestFixture();

		expect(
			fixture.violation_messages({
				'callable-object.ts': [
					'const feedback = {',
					'  write: async (text: string) => client.call(text),',
					'};',
				].join('\n'),
			})
		).toContain('avoid object literals that imitate classes');
	});

	test('detects forwarding functions and methods', () => {
		const fixture = new TestFixture();

		const messages = fixture.violation_messages({
			'forwarding.ts': [
				'function update(id: string, title: string) {',
				'  return flow.update(id, title);',
				'}',
				'class Contact {',
				'  public close_contact_reason(): string {',
				'    return this.required_reason();',
				'  }',
				'}',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid proxy methods and forwarding functions')
		).toHaveLength(2);
	});

	test('detects TypeScript re-export declarations', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'reexport.ts': [
				"export { Client } from './client';",
				"export type { ClientOptions } from './client';",
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'reexports')).toHaveLength(2);
	});

	test('detects module-level functions outside the exact root file', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'client.ts': 'export function create_client(): number { return 1; }\n',
		});

		expect(violations.filter(violation => violation.rule_id === 'function-placement')).toHaveLength(1);
	});

	test('detects module-level class instances', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'client.ts': ['class Client {}', 'const client = new Client();'].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'singleton')).toHaveLength(1);
	});

	test('rejects object literals returned as project classes or interfaces', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'contracts.ts': [
				'export interface User { name(): string; }',
				'export class Session { public id = "session"; public close(): void {} }',
			].join('\n'),
			'factory.ts': [
				"import { Session, User } from './contracts';",
				'export function create_user(): User { return { name: () => "Ada" }; }',
				'export function create_session(): Session { return { id: "session", close: () => {} }; }',
			].join('\n'),
			'data.ts': [
				'type UserData = { name: string };',
				'export function create_data(): UserData { return { name: "Ada" }; }',
			].join('\n'),
		});

		expect(
			violations.filter(violation => violation.rule_id === 'typescript-object-literal-return')
		).toHaveLength(2);
	});

	test('applies class-like count and size limits to Jest suites', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/jest-small.test.ts': [
				"describe('small', () => {",
				"  test('only test', () => {});",
				'});',
			].join('\n'),
			'tests/jest-large.test.ts': [
				"describe('large', () => {",
					...Array.from({ length: 140 }, (_, index) => `  const value_${index} = ${index};`),
					...Array.from({ length: 16 }, (_, index) => `  test('test ${index}', () => {});`),
				'});',
			].join('\n'),
		});

		expect(violations.map(violation => violation.rule_id)).toEqual(
			expect.arrayContaining(['typescript-jest-min-count', 'typescript-jest-max-size', 'typescript-jest-min-size', 'typescript-jest-max-count'])
		);
	});

	test('applies callable size limits to individual Jest tests', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/jest-test-size.test.ts': [
				"describe('test size', () => {",
				"  test('large test', () => {",
					...Array.from({ length: 20 }, (_, index) => `    const value_${index} = ${index};`),
				'  });',
				"  test('small test', () => {});",
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'test-max-size')).toHaveLength(1);
	});

	test('requires one flat top-level Jest describe', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/jest-structure.test.ts': [
				"describe('outer', () => {",
				"  describe('nested', () => { test('nested test', () => {}); });",
				'});',
				"describe('second', () => { test('second test', () => {}); });",
			].join('\n'),
		});

		expect(violations.map(violation => violation.rule_id)).toEqual(
			expect.arrayContaining(['typescript-jest-describe-count', 'typescript-jest-nested-describe'])
		);
	});

	test('requires Jest tests to end with expect', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'tests/jest-test-ending.test.ts': [
				"describe('test ending', () => {",
				"  test('bad order', () => {",
				'    expect(true).toBe(true);',
				'    const trailing_value = true;',
				'    expect(trailing_value).toBe(true);',
				'  });',
				"  test('good order', () => {",
				'    const value = true;',
				'    expect(value).toBe(true);',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-test-ending')).toHaveLength(1);
	});

	test('requires Jest tests to use arrow callbacks and contain expect', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/jest-test-shape.test.ts': [
				"describe('test shape', () => {",
				"  test('function callback', function named_callback() { expect(true).toBe(true); });",
				"  test('missing assertion', () => { const value = true; void value; });",
				'});',
			].join('\n'),
		});

		expect({
			lambda: violations.filter(violation => violation.rule_id === 'typescript-jest-test-lambda').length,
			expect: violations.filter(violation => violation.rule_id === 'typescript-jest-test-expect').length,
		}).toEqual({ lambda: 1, expect: 1 });
	});

	test('rejects Jest tests that only check runtime types', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/type-only.test.ts': [
				"describe('type-only tests', () => {",
				"  test('only checks construction', () => {",
				'    const resolver = new ProfileResolver();',
				'    expect(resolver).toBeInstanceOf(ProfileResolver);',
				'  });',
				"  test('checks behavior', () => {",
				'    const resolver = new ProfileResolver();',
				'    const result = resolver.resolve();',
				'    expect(resolver).toBeInstanceOf(ProfileResolver);',
				'    expect(result).toBe("resolved");',
				'  });',
				'});',
			].join('\n'),
		});

		const type_only_violations = violations.filter(violation => violation.rule_id === 'typescript-jest-type-only-test');
		expect(type_only_violations).toHaveLength(1);
		expect(type_only_violations[0]?.priority).toBe(6);
	});

	test('rejects Jest tests that only check fields and methods', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/shape-only.test.ts': [
				"describe('shape-only tests', () => {",
				"  test('only checks methods and fields', () => {",
				'    const resolver = new ProfileResolver();',
				'    expect(resolver).toHaveProperty("resolve");',
				'    expect(resolver).toEqual(expect.objectContaining({ cache: expect.any(Map) }));',
				'  });',
				"  test('checks behavior', () => {",
				'    expect(new ProfileResolver().resolve()).toBe("resolved");',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'typescript-jest-type-only-test')).toHaveLength(1);
	});

	test('rejects Jest tests that only check exceptions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/exception-only.test.ts': [
				"describe('exception-only tests', () => {",
				"  test('only checks the handler exception', async () => {",
				'    await expect(request_handler.handle(invalid_request)).rejects.toThrow();',
				'  });',
				"  test('checks the server response', async () => {",
				'    const response = await server.handle(invalid_request);',
				"    expect(response.status).toBe(400);",
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'test-exception-only')).toHaveLength(1);
		expect(violations.find(violation => violation.rule_id === 'test-exception-only')?.priority).toBe(6);
	});

	test('rejects Jest exception-only bypass patterns', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/exception-bypass.test.ts': [
				"describe('exception bypasses', () => {",
				"  test('manual catch', () => {",
				'    try { request_handler.handle(invalid_request); } catch { return; }',
				'  });',
				"  test('error type', () => {",
				'    try { request_handler.handle(invalid_request); } catch (error) {',
				'      expect(error instanceof Error).toBe(true);',
				'    }',
				'  });',
				"  test('raised flag', () => {",
				'    let raised = false;',
				'    try { request_handler.handle(invalid_request); } catch { raised = true; }',
				'    expect(raised).toBe(true);',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'test-exception-only')).toHaveLength(3);
	});
});
