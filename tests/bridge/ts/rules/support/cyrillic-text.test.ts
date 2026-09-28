import 'src/bridge/ts/rules/support/cyrillic-text-rules';
import 'src/bridge/ts/rules/support/directory-rules';
import { CyrillicTextRules } from 'src/bridge/ts/rules/support/cyrillic-text-rules';
import { TextFileDiscovery } from 'src/bridge/ts/core/markdown-file-discovery';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('Cyrillic comment and text file rules', () => {
	const rules = new CyrillicTextRules();
	const text_file_discovery = new TextFileDiscovery();

	test('reports Cyrillic in TypeScript comments but not strings', () => {
		const violations = rules.source_violations(
			'sample.ts',
			['// Привет', 'const message = "Привет";', '/*', ' * Мир', ' */'].join('\n'),
			false,
		);
		expect(violations.map(violation => violation.line)).toEqual([1, 3]);
	});

	test('reports Cyrillic in standalone TypeScript template comments', () => {
		const violations = rules.source_violations(
			'sample.ts',
			['`English comment', 'Привет`;', 'const message = `Русский value`;'].join('\n'),
			false,
		);
		expect(violations.map(violation => violation.line)).toEqual([1]);
	});

	test('reports Python comments but not string literals', () => {
		const violations = rules.source_violations(
			'sample.py',
			['message = "Привет # не комментарий"', '# Мир'].join('\n'),
			true,
		);
		expect(violations.map(violation => violation.line)).toEqual([2]);
	});

	test('reports one Cyrillic violation per text file', () => {
		const violations = rules.text_file_violations('README.md', '# Привет\n\nМир');

		expect({
			count: violations.length,
			lines: violations.map(violation => violation.line),
			files: violations.map(violation => violation.file),
		}).toEqual({ count: 1, lines: [1], files: ['README.md'] });
	});

	test('reports one Cyrillic violation per plain text file', () => {
		const violations = rules.text_file_violations('notes.txt', 'Привет\n\nМир');
		expect({
			count: violations.length,
			lines: violations.map(violation => violation.line),
			files: violations.map(violation => violation.file),
		}).toEqual({ count: 1, lines: [1], files: ['notes.txt'] });
	});

	test('discovers text files regardless of suffix case', () => {
		const fixture = new TestFixture();
		const violations = fixture.with_temporary_files(
			'webmcp-cyrillic-text-',
			{ 'NOTES.TXT': 'Привет' },
			root => text_file_discovery.violations(root, new Set()),
		);

		expect(violations).toHaveLength(1);
	});

	test('discovers plain text files for Cyrillic analysis', () => {
		const fixture = new TestFixture();
		const violations = fixture.with_temporary_files(
			'webmcp-cyrillic-text-',
			{ 'notes.txt': 'Привет\nМир' },
			root => text_file_discovery.violations(root, new Set()),
		);

		expect(violations).toHaveLength(1);
	});

	test('ignores Cyrillic inside a Python triple-quoted string', () => {
		const violations = rules.source_violations(
			'sample.py',
			['message = """Привет # не комментарий', 'ещё текст"""'].join('\n'),
			true,
		);
		expect(violations).toEqual([]);
	});

	test('reports Cyrillic in standalone Python triple-quoted comments', () => {
		const violations = rules.source_violations(
			'sample.py',
			['"""English comment', 'Привет', '"""', 'message = "Русский value"'].join('\n'),
			true,
		);
		expect(violations.map(violation => violation.line)).toEqual([2]);
	});

});
