import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('coding-lint syntax policy - state and TypeScript access', () => {
	const test_fixture = new TestFixture();
	test('allows explicit if statements in constructors', () => {
		const messages = test_fixture.violation_messages({
			'constructor-if.ts': [
				'class Consumer {',
				'  private readonly value: string;',
				'  constructor(value: string) {',
				'    if (!value) {',
				'      throw new Error("value required");',
				'    }',
				'    this.value = value;',
				'  }',
				'}',
			].join('\n'),
		});

		expect(messages).not.toContain('keep constructors limited to setup and validation');
	});

	test('reports TypeScript field assignments through this aliases', () => {
		const violations = test_fixture.collect_fixture_violations({
			'mutable-alias.ts': [
				'class Service {',
				'  value = 0;',
				'  update() {',
				'    const first = this;',
				'    const second = first;',
				'    second.value = 1;',
				'    let third: Service;',
				'    third = second;',
				'    third.value = 2;',
				'  }',
				'}',
			].join('\n'),
		});

		expect(
			violations.filter(item => item.message === 'avoid assigning class fields outside constructors')
		).toHaveLength(2);
	});

	test('rejects computed undefined checks for required fields', () => {
		const violations = test_fixture.collect_fixture_violations({
			'required-field-element-check.ts': [
				'type Parsed = { attribute_accesses: string[] };',
				'function has_attributes(parsed: Parsed): boolean {',
				"  return parsed['attribute_accesses'] === undefined;",
				'}',
				'function has_optional_attributes(parsed: Parsed): boolean {',
				'  return parsed?.[("attribute_accesses")].length > 0;',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'unnecessary-undefined-check',
				priority: 5,
			})
		);
	});

	test('rejects single-item array aliases', () => {
		const violations = test_fixture.collect_fixture_violations({
			'array-alias.ts': [
				'type Service = { value: string };',
				'function find_service(): Service[] { return []; }',
				'const services = find_service();',
				'const service = services[0];',
				'function find_wrapped_service(): Service[] { return ([]); }',
				'const wrapped_service = find_wrapped_service()[0];',
				'const parenthesized_service = (find_service())[0];',
				'const [aliased_find_service] = [find_service];',
				'const destructured_service = aliased_find_service()[0];',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(4);
	});

	test('rejects single-item access in nested callables', () => {
		const violations = test_fixture.collect_fixture_violations({
			'nested-array.ts': [
				'function make_items(): string[] { return ["item"]; }',
				'function read_nested(): string {',
				'\tconst make_nested = (): string[] => ["item"];',
				'\treturn make_nested().at(0);',
				'}',
				'const control = make_items().at(0);',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(2);
	});

	test('rejects bind callback construction', () => {
		const messages = test_fixture.violation_messages({
			'bound-callback.ts': [
				'const callback = service.run.bind(service);',
				'const wrapped_callback = (service.run.bind)(service);',
				'const asserted_callback = (service.run.bind as typeof service.run.bind)(service);',
				'const bound_callback = service.run.bind;',
				'bound_callback(service);',
				'const method_name = "bind";',
				'service.run[method_name](service);',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid .bind calls')).toHaveLength(5);
	});

	test('rejects private member access from outside its class', () => {

		const messages = test_fixture.violation_messages({
			'private.ts': [
				'class Sample {',
				'  private secret() {}',
				'  inside() { this.secret(); }',
				'}',
				'const sample = new Sample();',
				'sample.secret();',
			].join('\n'),
		});

		expect(messages).toContain(
			'private class members must not be accessed from outside their class'
		);
	});

	test('rejects private member access through instance aliases', () => {
		const messages = test_fixture.violation_messages({
			'private-alias.ts': [
				'class Sample {',
				'  private secret = 1;',
				'}',
				'const sample = new Sample();',
				'const alias = sample;',
				'alias.secret;',
				'alias["secret"];',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'private class members must not be accessed from outside their class')).toHaveLength(2);
	});

	test('rejects static private member element access from outside its class', () => {
		const messages = test_fixture.violation_messages({
			'private-element-access.ts': [
				'class Sample {',
				'  private secret() {}',
				'  inside() { this["secret"](); }',
				'}',
				'const sample = new Sample();',
				'sample.secret();',
				'sample["secret"]();',
				'sample[`secret`]();',
				'sample[("secret")]();',
			].join('\n'),
		});

		expect(
			messages.filter(
				message => message === 'private class members must not be accessed from outside their class'
			)
		).toHaveLength(4);
	});
});
