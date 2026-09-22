import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { conditional_block_files, forwarding_files } from 'tests/core/constants';


describe('coding-lint syntax and policy rules', () => {
	test('rejects ternary expressions and conditional execution operators', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'conditional.ts': [
				'const label = ready ? "yes" : "no";',
				'ready && submit();',
				'ready || recover();',
				'const state = left && right;',
				'const callback = ready && (() => submit());',
				'const created = value ?? create();',
			].join('\n'),
			'conditional.py': [
				'label = "yes" if ready else "no"',
				'ready and submit()',
				'ready or recover()',
				'state = left and right',
				'callback = ready and (lambda: submit())',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid ternary expressions')).toHaveLength(0);
		expect(
			messages.filter(message => message === 'avoid conditional execution operators')
		).toHaveLength(5);
	});

	test('allows logical expressions outside assignments', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'standalone.ts': 'ready && submit();\nready || recover();',
			'standalone.py': 'ready and submit()\nready or recover()',
		});

		expect(messages).not.toContain('avoid conditional execution operators');
	});

	test('rejects nullish coalescing in call arguments', () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			'call-argument.ts': 'consume(value ?? fallback);',
		});
		expect(messages.filter(message => message === 'avoid conditional execution operators')).toHaveLength(1);
	});

	test('allows short-circuit expressions with boolean operands', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'boolean-conditions.ts': [
				'const left: boolean = true;',
				'const right = 1 < 2;',
				'const first = left && right;',
				'const second = (left || right) && !left;',
			].join('\n'),
		});

		expect(messages).not.toContain('avoid conditional execution operators');
	});

	test('allows short-circuit expressions with explicitly boolean calls', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'boolean-calls.ts': [
				'function is_ready(): boolean { return true; }',
				'class State { public is_open(): boolean { return true; } }',
				'const state = new State();',
				'const first = is_ready() || state.is_open();',
			].join('\n'),
		});

		expect(messages).not.toContain('avoid conditional execution operators');
	});

	test('rejects logical assignments and switch-style dispatch', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'dispatch.ts': [
				'let value: string | undefined;',
				'value ??= create_value();',
				'let enabled = false;',
				'enabled ||= is_enabled();',
				'enabled &&= is_enabled();',
				'switch (value) {',
				"  case 'ready':",
				'    create_value();',
				'    break;',
				'}',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid logical assignment operators')
		).toHaveLength(3);
		expect(messages).toContain('avoid switch statements');
	});

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
