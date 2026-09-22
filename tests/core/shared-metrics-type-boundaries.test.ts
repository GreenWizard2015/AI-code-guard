import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { python_composition_files } from 'tests/core/constants';


describe('coding-lint shared metrics - grouped type boundaries', () => {
	test('rejects generic class field types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'generic-fields.ts': [
				'class GenericFields {',
				'  any_value: any;',
				'  object_value: object;',
				'  unknown_value: unknown;',
				'}',
			].join('\n'),
		});

		expect(
			violations
				.filter(item => item.message.includes('field') && item.message.includes('instead'))
				.map(item => item.priority)
		).toEqual([5, 5, 5]);
		expect(
			violations
				.filter(item => item.message.includes('field') && item.message.includes('instead'))
				.map(item => item.rule_id)
		).toEqual(['type-warning', 'type-warning', 'type-warning']);
	});

	test('does not ignore project-owned boundary types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'reviewed-boundaries.ts': [
				'function first(request: DispatchRequest) { return request.method + request.path; }',
				'function second(request: DispatchRequest) { return request.method + request.path; }',
				'function third(request: DispatchRequest) { return request.method + request.path; }',
				'function fourth(request: DispatchRequest) { return request.method + request.path; }',
				'function render(message: FacebookMessage) { return message.name + message.text; }',
				'function serialize(message: FacebookMessage) { return message.name + message.text; }',
				'function display(message: FacebookMessage) { return message.name + message.text; }',
				'function format(message: FacebookMessage) { return message.name + message.text; }',
			].join('\n'),
		});

		expect(violations.some(item => item.message.includes('share parameter type'))).toBe(true);
	});

	test('hints at a wrapper and checking all usages for shared platform types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'platform-wrapper.ts': [
				'type TextAreaElement = { value: string };',
				'class Editor {',
				'  set(input: TextAreaElement) { return input.value + input.value; }',
				'  clear(input: TextAreaElement) { return input.value + input.value; }',
				'  length(input: TextAreaElement) { return input.value + input.value; }',
				'  read(input: TextAreaElement) { return input.value + input.value; }',
				'}',
			].join('\n'),
		});

		const violation = violations.find(item => item.message.includes('share parameter type'));
		expect(violation?.hint).toContain('every production use');
		expect(violation?.hint).toContain('focused project wrapper');
	});

	test('reports Python class composition through relative imports', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages(python_composition_files);

		expect(messages).toContain(
			'class composition is too deep (found 4 levels): Root -> Middle -> Leaf -> End'
		);
	});
});
