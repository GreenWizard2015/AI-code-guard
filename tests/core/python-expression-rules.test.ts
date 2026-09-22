import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python expression rules', () => {
	test('rejects Python assignment expressions but allows ordinary assignments', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'assignment-expressions.py': ['value = 1', 'if (value := 2):', '    value += 1'].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid Python assignment expressions')
		).toHaveLength(1);
	});

	test('allows ternaries whose branches are primitive literals', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'primitive-ternaries.py': [
				'value = 1 if enabled else 0',
				'result = make_value() if enabled else fallback',
				'typed: str = make_value() if enabled else fallback',
			].join('\n'),
			'primitive-ternaries.ts': [
				'const value = enabled ? 1 : 0;',
				'const result = enabled ? makeValue() : fallback;',
				'const typed: string = makeValue() ? makeValue() : fallback;',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid ternary expressions')).toHaveLength(3);
	});
});
