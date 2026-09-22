import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';


describe('coding-lint syntax policy control flow - object values', () => {
	test('rejects namespace-shaped objects with multiple callable fields', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'fake-object.ts': [
				'export const CHAT_INPUT_TOOLS = {',
				'  getComposerInput: (input: HTMLElement) => input,',
				'  getComposerInputOrNull: (input: HTMLElement) => input,',
				'  isComposerEmpty: (input: HTMLElement) => !input.textContent,',
				'};',
				'const CONFIG = { timeoutMs: 1000, enabled: true };',
			].join('\n'),
		});

		expect(messages).toContain('avoid object literals that imitate classes');
	});

	test('rejects class-like objects with one method even when not exported', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'parser.ts': [
				'const AGENT_PARSER = {',
				'  raise_task_error(payload: unknown): void { throw new Error(String(payload)); },',
				'};',
			].join('\n'),
		});

		expect(messages).toContain('avoid object literals that imitate classes');
	});

	test('rejects callable object literals regardless of variable name', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'callable-object.ts': [
				'const value = {',
				'  run(input: string) { return input; },',
				'};',
			].join('\n'),
		});

		expect(messages).toContain('avoid object literals that imitate classes');
	});

	test('does not report callable test doubles', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'tests/callable-object.test.ts': [
				'const value = {',
				'  run(input: string) { return input; },',
				'};',
			].join('\n'),
		});

		expect(messages).not.toContain('avoid object literals that imitate classes');
	});

	test('rejects callable options passed as an argument', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'callable-options.ts': ['configure({', '  onStart() {},', '});'].join('\n'),
		});

		expect(messages).toContain('avoid object literals that imitate classes');
	});

	test('rejects callable result objects created inside functions', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'factory.ts': [
				'function create_tools() {',
				'  return {',
				'    async ask_thread(id: string, message: string) {',
				'      await submit_message(id, message);',
				'      return { id, submitted: true };',
				'    },',
				'  };',
				'}',
			].join('\n'),
		});

		expect(messages).toContain('avoid object literals that imitate classes');
	});

});
