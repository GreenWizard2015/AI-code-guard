import { DirectoryCommentSegments } from 'src/bridge/ts/core/support/directory-comment-segments';
import { DirectoryStructureRules } from 'src/bridge/ts/rules/support/directory-structure-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { join } from 'node:path';

import { describe, expect, test } from '@jest/globals';



describe('directory size lint rules', () => {
	const test_fixture = new TestFixture();
	const class_count_files = Object.fromEntries([
		...Array.from({ length: 16 }, (_, index) => [`a/b/c/large-${index}.ts`, 'export class Item {}\n']),
		...Array.from({ length: 5 }, (_, index) => [`a/b/c/d/valid-${index}.ts`, 'export class Item {}\n']),
		...Array.from({ length: 2 }, (_, index) => [`a/b/c/d/e/small-${index}.ts`, 'export class Item {}\n']),
	]);

	test('keeps docstrings in raw file counts unless explicitly ignored', () => {
		const directory_comment_segments = new DirectoryCommentSegments();

		const source = ['"""module documentation"""', '', 'value = 1'].join('\n');

		expect(directory_comment_segments.count_code_lines(source, true)).toBe(2);
		expect(
			directory_comment_segments.count_code_lines(source, true, [{ start_line: 0, start_column: 0, end_line: 0, end_column: 27 }])
		).toBe(1);
	});

	test('keeps code after a same-line docstring in raw file counts', () => {
		const directory_comment_segments = new DirectoryCommentSegments();

		const source = '"""doc"""; value = 1';

		expect(
			directory_comment_segments.count_code_lines(source, true, [{ start_line: 0, start_column: 0, end_line: 0, end_column: 9 }])
		).toBe(1);
	});

	test('applies the raw maximum file size to Python test files', () => {
		const source = Array.from({ length: 501 }, (_, index) => `value_${index} = ${index}`).join(
			'\n'
		);
		const violations = test_fixture.collect_fixture_violations({
			'tests/large_test.py': source,
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'file is too large (found 501 raw lines)',
				rule_id: 'file-max-size',
				priority: 3,
			})
		);
	});

	test('reports directories with more than 40 code files', () => {
		const files = Object.fromEntries(
			Array.from({ length: 41 }, (_, index) => [`source/file-${index}.ts`, 'export const value = 1;\n'])
		);
		const report = test_fixture.collect_fixture_report(files);
		expect(report.violations).toContainEqual(expect.objectContaining({
			message: 'directory contains too many files (found 41)',
			rule_id: 'directory-max-size',
		}));
	});

	test('does not exempt a nested functions directory from directory size rules', () => {
		const directory_rules = new DirectoryStructureRules();
		const violations = test_fixture.with_temporary_files(
			'webmcp-coding-lint-functions-directory-',
			{
				'functions/worker/functions.ts': 'export const value = 1;\n',
				'functions/worker/helper.ts': 'export const value = 1;\n',
			},
			root => directory_rules.directory_violation(join(root, 'functions/worker'), root)
		);
		expect(violations[0]).toEqual(expect.objectContaining({
			message: 'directory contains too few files (found 2)',
		rule_id: 'directory-min-size',
	}));
	});

	test('reports the maximum class count in a direct source directory', () => {
		const directory_rules = new DirectoryStructureRules();
		const violations = test_fixture.with_temporary_files('coding-lint-directory-', class_count_files, root => {
			const paths = Object.keys(class_count_files).map(file => join(root, file));
			const class_counts = new Map(paths.map(file => [file, 1]));
			const collected: ReturnType<DirectoryStructureRules['directory_violation']> = [];
			directory_rules.append_directory_violations(collected, paths, root, class_counts, new Map());
			return collected;
		});
		expect(violations).toContainEqual(expect.objectContaining({
			message: 'directory contains too many classes (found 16)',
			rule_id: 'directory-class-max-size',
	}));
	});

	test('reports the minimum class count only for direct source files', () => {
		const directory_rules = new DirectoryStructureRules();
		const violations = test_fixture.with_temporary_files('coding-lint-directory-', class_count_files, root => {
			const paths = Object.keys(class_count_files).map(file => join(root, file));
			const class_counts = new Map(paths.map(file => [file, 1]));
			const collected: ReturnType<DirectoryStructureRules['directory_violation']> = [];
			directory_rules.append_directory_violations(collected, paths, root, class_counts, new Map());
			return collected;
		});
		expect(violations).toContainEqual(expect.objectContaining({
			message: 'directory contains too few classes (found 2)',
			rule_id: 'directory-class-min-size',
		}));
		expect(violations.map(violation => violation.message)).not.toContain(
			'directory contains too few classes (found 5)'
		);
	});

	test('allows only re-exports in facade-only directories', () => {
		const report = test_fixture.collect_fixture_report({
			'facade/index.ts': 'export { Service } from "./service";\n',
			'bad-ts/index.ts': 'export class Service {}\n',
			'bad-py/__init__.py': 'class Service:\n    pass\n',
		});
		expect(report.violations.filter(item => item.rule_id === 'facade-file-content')).toHaveLength(2);
	});
});
