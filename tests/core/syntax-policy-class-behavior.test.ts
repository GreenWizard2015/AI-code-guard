import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { forbidden_syntax_probe_files } from 'tests/core/constants';


describe('coding-lint syntax policy control flow - class behavior', () => {
	test('requires public methods at the end of classes', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'typescript.ts': ['class Sample {', '  publicApi() {}', '  private helper() {}', '}'].join(
				'\n'
			),
			'python.py': [
				'class Sample:',
				'    def public_api(self):',
				'        return 1',
				'    def _helper(self):',
				'        return 2',
			].join('\n'),
		});

		expect(
			messages.filter(
				message =>
					message.startsWith('public method ') &&
					message.endsWith('must be declared after private/protected methods')
			)
		).toHaveLength(2);
	});

	test('allows private methods before public methods', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'typescript.ts': ['class Sample {', '  private helper() {}', '  publicApi() {}', '}'].join(
				'\n'
			),
			'python.py': [
				'class Sample:',
				'    def _helper(self):',
				'        return 2',
				'    def public_api(self):',
				'        return 1',
			].join('\n'),
		});

		expect(messages.some(message => message.startsWith('public method '))).toBe(false);
	});

	test('requires the constructor after implementation and before public methods', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'typescript.ts': [
				'class Sample {',
				'  publicApi() {}',
				'  constructor() {}',
				'  private helper() {}',
				'}',
			].join('\n'),
			'python.py': [
				'class Sample:',
				'    def public_api(self):',
				'        return 1',
				'    def __init__(self):',
				'        self.value = 1',
				'    def _helper(self):',
				'        return 2',
			].join('\n'),
		});

		expect(messages).toEqual(
			expect.arrayContaining([
				'constructor must be declared before public methods',
				'constructor must be declared after private/protected methods',
			])
		);
	});

	test('reports forbidden syntax for TypeScript and Python', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages(forbidden_syntax_probe_files);

		expect(messages).toEqual(
			expect.arrayContaining([
				'avoid broad try/catch or try/except blocks',
				'catch one exception type per except handler',
				'avoid static methods',
				'avoid class methods',
				'avoid prototype-based class construction',
				'avoid dynamic class construction with type(...)',
				'avoid repeated isinstance checks in business logic',
				'avoid getattr for normal control flow',
				'avoid setattr for normal control flow',
				'avoid callable feature detection for project-owned interfaces',
				'avoid inferring tool results from multiple shapes',
				'avoid Object.prototype.toString.call',
				'avoid calling methods on temporary instances',
				'function has too many arguments (found 6)',
			])
		);
	});

	test('recommends a lookup map for repeated value branches', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'branches.ts': [
				'function render(kind: string) {',
				'  if (kind === "A") return "a";',
				'  else if (kind === "B") return "b";',
				'  return "other";',
				'}',
			].join('\n'),
			'branches.py': [
				'def render(kind):',
				'    if kind == "A":',
				'        return "a"',
				'    elif kind == "B":',
				'        return "b"',
				'    return "other"',
			].join('\n'),
		});

		expect(
			messages.filter(
				message => message === 'repeated comparisons of one variable should use a lookup map'
			)
		).toHaveLength(2);
	});
});
