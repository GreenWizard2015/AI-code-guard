import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { mixed_dependency_files, constructor_files } from 'tests/core/constants';

describe('coding-lint syntax and policy rules - interface contracts', () => {
	const test_fixture = new TestFixture();

	test('does not recommend interfaces for mixed dependency options', () => {
		const messages = test_fixture.violation_messages(mixed_dependency_files);
		const interface_diagnostics = messages.filter(message => message.includes('use an interface instead of a callable-heavy type alias or object shape'));
		expect(interface_diagnostics).toEqual([]);
		expect(messages).not.toContain('use an interface instead of a callable-heavy type alias or object shape');
	});

	test('does not warn on interfaces that only describe methods', () => {
		const messages = test_fixture.violation_messages({
			'method-only-interface.ts': 'interface ChatGptThreadListLoader { fetch_thread_list(pattern: string): Promise<unknown>; }',
		});
		expect(messages).not.toContain('use an interface instead of a callable-heavy type alias or object shape');
	});

	test('counts index signatures as data in object type aliases', () => {
		const messages = test_fixture.violation_messages({
			'index-signature.ts': 'type RuntimeRecord = { [key: string]: string };',
		});
		expect(messages).not.toContain('use an interface instead of a callable-heavy type alias or object shape');
	});

	test('rejects index signatures', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'index-signature.ts': 'type RuntimeRecord = { [key: string]: string };',
		});

		expect(violations).toContainEqual(expect.objectContaining({
			rule_id: 'typescript-index-signature',
			priority: 5,
		}));
	});

	test('does not warn on mixed option data and callbacks', () => {
		const messages = test_fixture.violation_messages({
			'options.ts': ['type Options = {', '  enabled: boolean;', '  on_start?: () => void;', '  on_complete?: () => void;', '  on_failure?: () => void;', '  on_error?: () => void;', '};'].join('\n'),
		});
		expect(messages).not.toContain('use an interface instead of a callable-heavy type alias or object shape');
	});

	test('keeps constructors limited to validation and dependency setup', () => {
		const violations = test_fixture.collect_fixture_violations(constructor_files);
		const messages = violations.map(item => item.message);
		expect(messages.filter(message => message === 'keep constructors limited to setup and validation')).toHaveLength(2);
	});
});
