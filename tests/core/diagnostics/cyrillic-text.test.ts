import { CyrillicTextRules } from 'src/bridge/ts/rules/support/cyrillic-text-rules';
import { describe, expect, test } from '@jest/globals';

describe('Cyrillic comment and Markdown rules', () => {
	const rules = new CyrillicTextRules();

	test('reports Cyrillic in TypeScript comments but not strings', () => {
		const violations = rules.source_violations(
			'sample.ts',
			['// Привет', 'const message = "Привет";', '/*', ' * Мир', ' */'].join('\n'),
			false,
		);
		expect(violations.map(violation => violation.line)).toEqual([1, 3]);
	});

	test('reports Python comments but not string literals', () => {
		const violations = rules.source_violations(
			'sample.py',
			['message = "Привет # не комментарий"', '# Мир'].join('\n'),
			true,
		);
		expect(violations.map(violation => violation.line)).toEqual([2]);
	});

	test('reports Cyrillic in Markdown by line', () => {
		const violations = rules.markdown_violations('README.md', '# Привет\n\nМир');
		expect({
			count: violations.length,
			lines: violations.map(violation => violation.line),
			files: violations.map(violation => violation.file),
		}).toEqual({ count: 2, lines: [1, 3], files: ['README.md', 'README.md'] });
	});

	test('ignores Cyrillic inside a Python triple-quoted string', () => {
		const violations = rules.source_violations(
			'sample.py',
			['message = """Привет # не комментарий', 'ещё текст"""'].join('\n'),
			true,
		);
		expect(violations).toEqual([]);
	});

});
