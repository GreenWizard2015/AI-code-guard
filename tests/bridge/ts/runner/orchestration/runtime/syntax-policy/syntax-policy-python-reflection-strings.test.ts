import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

describe('coding-lint Python reflection string keys', () => {
	test('rejects static f-string reads through reflection', () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			'private-fstring-read.py': [
				'class Sample:',
				'    def __init__(self):',
				'        self._secret = 1',
				'sample = Sample()',
				'getattr(sample, f"_secret")',
				'sample.__getattribute__(f"_secret")',
				'sample.__dict__[f"_secret"]',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'private class members must not be accessed from outside their class')).toHaveLength(3);
	});

	test('rejects static f-string writes through reflection', () => {
		const fixture = new TestFixture();
		const messages = fixture.violation_messages({
			'private-fstring-write.py': [
				'class Sample:',
				'    def __init__(self):',
				'        self._secret = 1',
				'sample = Sample()',
				'setattr(sample, f"_secret", 2)',
				'sample.__setattr__(f"_secret", 2)',
				'sample.__dict__[f"_secret"] = 2',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'private class members must not be accessed from outside their class')).toHaveLength(3);
	});
});
