import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { conditional_block_files, forwarding_files } from 'tests/core/constants';


describe('coding-lint syntax and policy rules', () => {
	test('rejects Python match-case dispatch', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'match.py': [
				'def resolve(value):',
				'    match value:',
				'        case "ready":',
				'            return handle_ready()',
				'        case _:',
				'            return handle_other()',
			].join('\n'),
		});

		expect(messages).toContain('avoid switch statements');
	});

	test('allows primitive logical assignments but rejects object logical assignments', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'primitive-conditions.ts': [
				'const text = "a" || "b";',
				'const number = 1 && 2;',
				'const object = left && right;',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid conditional execution operators')
		).toHaveLength(1);
	});

	test('rejects every nullish coalescing expression', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'typed-conditions.ts': [
				'interface Metadata { externalId?: string; }',
				'declare const metadata: Metadata;',
				'const first = metadata.externalId ?? "fallback";',
				'const left: string | undefined = "left";',
				'const right: string | undefined = "right";',
				'const second = left ?? right;',
				'declare const object: Record<string, string>;',
				'const invalid = object ?? metadata;',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid conditional execution operators')
		).toHaveLength(3);
	});

	test('requires TypeScript conditional blocks and rejects Python elif', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages(conditional_block_files);

		expect(
			messages.filter(message => message === 'TypeScript if and else branches must use braces')
		).toHaveLength(2);
		expect(messages.filter(message => message === 'avoid Python elif branches')).toHaveLength(1);
	});

	test('rejects TypeScript else without braces', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'else-without-braces.ts': 'if (ready) { submit(); } else recover();',
		});

		expect(violations).toContainEqual(expect.objectContaining({
			rule_id: 'typescript-conditional-block',
			message: 'TypeScript if and else branches must use braces',
		}));
	});

	test('rejects methods and functions that only forward their arguments', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages(forwarding_files);

		expect(
			messages.filter(message => message === 'avoid proxy methods and forwarding functions')
		).toHaveLength(12);
	});

	test('rejects parenthesized proxy calls', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parenthesized-proxy.ts': [
				'declare const service: { run(value: string): string };',
				'function forward(value: string): string {',
				'  return (service.run)(value);',
				'}',
				'function forward_call(value: string): string {',
				'  return (service.run(value));',
				'}',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'proxy-callable')).toHaveLength(2);
	});

	test('rejects awaited proxy calls', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'awaited-proxy.ts': [
				'async function forward(value: string): Promise<string> {',
				'  return await handle(value);',
				'}',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'proxy-callable')).toHaveLength(1);
	});

	test('rejects array spread proxy calls', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'spread-proxy.ts': [
				'declare const service: { run(value: string): string };',
				'function forward(value: string): string {',
				'  return service.run(...[value]);',
				'}',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'proxy-callable')).toHaveLength(1);
	});

	test('rejects boolean predicates that only expose their own state', () => {
		const fixture = new TestFixture();

		const violations = fixture.collect_fixture_violations({
			'polling-state.ts': [
				'class PollingState {',
				'\tprivate readonly available: boolean;',
				'\tpublic present(): boolean { return this.available; }',
				'}',
			].join('\n'),
		});

		expect(violations.filter(violation => violation.rule_id === 'proxy-callable')).toHaveLength(1);
	});

});
