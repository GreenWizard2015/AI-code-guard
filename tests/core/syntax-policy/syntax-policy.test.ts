import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { contract_field_files } from 'tests/core/constants';

describe('coding-lint syntax and policy rules', () => {
	const test_fixture = new TestFixture();
	test('rejects complex default parameters in TypeScript and Python', () => {
		const messages = test_fixture.violation_messages({
			'complex-defaults.ts': [
				'class Reader {}',
				'function build(reader: Reader = new Reader(), values: string[] = [], options = {}) {}',
			].join('\n'),
			'complex-defaults.py': [
				'class Reader:',
				'    pass',
				'',
				'def build(reader: Reader = Reader(), values: list[str] = [], options: dict = {}):',
				'    return reader, values, flag',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid complex default parameter values')
		).toHaveLength(2);
	});

	test('allows primitive defaults', () => {
			const messages = test_fixture.violation_messages({
				'primitive-defaults.ts':
					'function build(name = "", count = 0, enabled = false, value = null, values = [], options = {}) {}',
				'primitive-defaults.py':
					'def build(name = "", count = 0, enabled = False, value = None, values = [], options = {}):\n    pass',
		});

		expect(messages).not.toContain('avoid complex default parameter values');
	});

	test('rejects TypeScript overload signatures', () => {
		const violations = test_fixture.collect_fixture_violations({
			'overloads.ts': [
				'function load(value: string): string;',
				'function load(value: number): string;',
				'function load(value: string | number): string { return String(value); }',
				'class Reader {',
				'  read(value: string): string;',
				'  read(value: number): string;',
				'  read(value: string | number): string { return String(value); }',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-overload')).toHaveLength(4);
	});

	test('rejects empty protocols and interfaces', () => {
		const messages = test_fixture.violation_messages({
			'empty-contracts.ts': 'interface Empty {}',
			'empty-contracts.py': [
				'from typing import Protocol',
				'class Empty(Protocol):',
				'    pass',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid empty protocols and interfaces')
		).toHaveLength(2);
	});

	test('does not require methods on structural type aliases', () => {
		const messages = test_fixture.violation_messages({
			'structural-type.ts': 'type RuntimeShape = { value: string };',
		});

		expect(messages).not.toEqual(
			expect.arrayContaining([
				expect.stringContaining('class has'),
				expect.stringContaining('method'),
			])
		);
	});

	test('rejects bare aliases but allows structural and template aliases', () => {

		const messages = test_fixture.violation_messages({
			'bare-aliases.ts': [
				'type Existing = string;',
				'export type Renamed = Existing;',
				'export type Qualified = Namespace.Existing;',
				'type Identity<T> = T;',
				'type Shape = { value: string };',
				'type Values = Existing[];',
				'type Factory = () => Existing;',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid bare type aliases')).toHaveLength(2);
	});

	test('requires explicit TypeScript constructor fields', () => {
		const messages = test_fixture.violation_messages({
			'parameter-properties.ts': [
				'class Client {',
				'  private readonly transport: Transport;',
				'  constructor(private readonly transport: Transport) {}',
				'  constructor(public cache: Cache) {}',
				'}',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'declare TypeScript constructor fields explicitly')
		).toHaveLength(2);
	});

	test('rejects fields in interfaces and protocols but allows methods', () => {

		const messages = test_fixture.violation_messages(contract_field_files);

		expect({
			cache: messages.filter(message => message.includes('must not declare field "cache"')).length,
			enabled: messages.includes('protocol "UserStore" must not declare field "enabled"'),
			data_value: messages.includes('interface "DataShape" must not declare field "value"'),
			interface_get: messages.includes('interface "UserStore" must not declare field "get"'),
			protocol_get: messages.includes('protocol "UserStore" must not declare field "get"'),
		}).toEqual({ cache: 2, enabled: true, data_value: false, interface_get: false, protocol_get: false });
	});

});
