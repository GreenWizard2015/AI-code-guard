import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python expression edge cases', () => {
	test('allows ordinary Python assignments', () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({ 'assignment.py': 'value = 1\n' });
		expect({
			assignment: messages.filter(message => message === 'avoid Python assignment expressions').length,
			ternary: messages.filter(message => message === 'avoid ternary expressions').length,
		}).toEqual({ assignment: 0, ternary: 0 });
	});

	test('reports non-primitive Python ternaries', () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			'ternary.py': 'value = make_value() if enabled else fallback\n',
		});
		expect({
			has_ternary: messages.includes('avoid ternary expressions'),
			ternary_count: messages.filter(message => message === 'avoid ternary expressions').length,
			has_assignment: messages.includes('avoid Python assignment expressions'),
		}).toEqual({ has_ternary: true, ternary_count: 1, has_assignment: false });
	});

	test('reports assignment expressions inside conditions', () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			'condition.py': 'if (value := load_value()):\n    pass\n',
		});
		expect(messages.filter(message => message === 'avoid Python assignment expressions')).toHaveLength(1);
	});
});
