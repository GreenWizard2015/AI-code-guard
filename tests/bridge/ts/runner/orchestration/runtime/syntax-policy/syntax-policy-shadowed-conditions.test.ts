import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('coding-lint lexical binding rules', () => {
	test('resolves short-circuit operands in their lexical scope', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'shadowed-conditions.ts': [
				"const left: string = '';",
				"const right: string = '';",
				'function candidate(): object {',
				'\tconst left = {};',
				'\tconst right = {};',
				'\tconst result = left || right;',
				'\treturn result;',
				'}',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid conditional execution operators')).toHaveLength(1);
	});

	test('does not inherit boolean types from shadowed module bindings', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'shadowed-boolean.ts': [
				'const enabled: boolean = true;',
				'function candidate(): object {',
				'\tconst enabled = {};',
				'\tconst result = enabled || {};',
				'\treturn result;',
				'}',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid conditional execution operators')).toHaveLength(1);
	});
});
