import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';


describe('coding-lint syntax policy control flow - object values', () => {
		test('rejects computed multiple-result shape keys', () => {
			const test_fixture = new TestFixture();
			const messages = test_fixture.violation_messages({
				'result-shapes.ts': [
					'declare const result: Result;',
					"result['structuredContent'];",
					'result[`unwrap_tool_result`];',
					'result[("structuredContent")];',
					'const shape_key = "structuredContent";',
					'const response = {};',
					'response[shape_key];',
					'response["structured" + "Content"];',
				].join('\n'),
				'result-shapes.py': [
					'shape_key = "structuredContent"',
					'response = {}',
					'value = response[shape_key]',
				].join('\n'),
			});

		expect(
			messages.filter(message => message === 'avoid inferring tool results from multiple shapes')
		).toHaveLength(5);
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

	test('rejects callable object literal return aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create(): Contract {',
				'  const value = { run() {} };',
				'  return value;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});

	test('rejects callable object return spreads', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create_spread(): Contract {',
				'  const service = { run() {} };',
				'  return { ...service };',
				'}',
				'function create_asserted_spread(): Contract {',
				'  const service = { run() {} };',
				'  return { ...(service as Contract) };',
				'}',
				'function create_inline_spread(): Contract {',
				'  return { ...{ run() {} } };',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(3);
	});

	test('rejects callable object return branches', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create_conditional(use_first: boolean): Contract {',
				'  return use_first ? { run() {} } : { run() {} };',
				'}',
				'function create_logical(use_first: boolean): Contract {',
				'  return (use_first && { run() {} }) || { run() {} };',
				'}',
				'function create_nullish(existing: Contract | undefined): Contract {',
				'  return existing ?? { run() {} };',
				'}',
				'function create_comma(use_first: boolean): Contract {',
				'  return (use_first, { run() {} });',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(4);
	});

	test('rejects destructured callable object returns', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create_object(): Contract {',
				'  const { run } = { run() {} };',
				'  return { run };',
				'}',
				'function create_array(): Contract {',
				'  const [run] = [() => {}];',
				'  return { run };',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(2);
	});

	test('rejects nested callable object aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create_nested(): Contract {',
				'  const { service: { run } } = { service: { run() {} } };',
				'  return { run };',
				'}',
				'function create_spread(): Contract {',
				'  const { service } = ({ service: { run() {} } });',
				'  return { ...service };',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(2);
	});

	test('rejects indexed callable object returns', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Contract { run(): void; }',
			'factory.ts': [
				'function create(): Contract {',
				'  return [{ run() {} }][0];',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(1);
	});

});
