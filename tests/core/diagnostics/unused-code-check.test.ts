import { UnusedCode } from 'src/bridge/ts/core/unused-code';
import { ProjectSourceScanner } from 'src/bridge/ts/project-source-scanner';
import { SOURCE_OPTIONS } from 'tests/core/constants';
import { TestFixture } from 'tests/core/test-fixture';
import { join } from 'node:path';
import { ProjectSourcePython } from 'src/project-source-python';

import { describe, expect, jest, test } from '@jest/globals';

describe('unused code checker', () => {
	const fixture = new TestFixture();

	test('reports unreachable TypeScript files and follows relative imports', () => {
		const unused_code = new UnusedCode();
		const files = fixture.with_temporary_files('webmcp-unused-code-', {
			'tools/coding-lint/index.ts': "export { value } from './reachable';\n",
			'tools/coding-lint/reachable.ts': 'export const value = 1;\n',
			'tools/coding-lint/unused.ts': 'export const unused = 1;\n',
		}, root => unused_code.collect_unused_files(root, {
			...SOURCE_OPTIONS,
			entry_files: ['tools/coding-lint/index.ts'],
		}));
		expect(files.map(violation => violation.file)).toEqual(['tools/coding-lint/unused.ts']);
	});

	test('does not report an imported module as unused', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-unused-code-reachable-', {
			'tools/coding-lint/index.ts': "export { value } from './dependency';\n",
			'tools/coding-lint/dependency.ts': 'export const value = 1;\n',
		}, root => unused_code.collect_unused_files(root, {
			...SOURCE_OPTIONS,
			entry_files: ['tools/coding-lint/index.ts'],
		}));
		expect(violations).toEqual([]);
	});

	test('recognizes Node TypeScript shebangs as entry points', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-node-shebang-entry-', {
			'tools/coding-lint/cli.ts': '#!/usr/bin/env node\nexport { value } from "./dependency";\n',
			'tools/coding-lint/dependency.ts': 'export const value = 1;\n',
			'tools/coding-lint/unused.ts': 'export const unused = 1;\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations).toEqual([
			expect.objectContaining({ file: 'tools/coding-lint/unused.ts', rule_id: 'unused-file' }),
		]);
	});

	test('recognizes root functions files as entry points', () => {
		const files = ['functions.ts', 'functions.tsx', 'functions.py'];
		const entries = fixture.with_temporary_files(
			'webmcp-functions-entry-',
			Object.fromEntries(files.map(file => [file, 'export const value = 1;\n'])),
			root => {
				const scanner = new ProjectSourceScanner(root, SOURCE_OPTIONS);
				return files.map(file => scanner.entry(join(root, file)));
			}
		);
		expect(entries).toEqual([true, true, true]);
	});

	test('caches Python import path parts for a stable file set', () => {
		const resolver = new ProjectSourcePython();
		const files = new Set(['/repo/tools/webmcp/module.py']);
		const iterator = jest.spyOn(files, Symbol.iterator);

		expect({
			first_result: resolver.python_import('/repo', 'tools.webmcp', files),
			second_result: resolver.python_import('/repo', 'tools.webmcp.other', files),
			iterator_calls: iterator.mock.calls.length,
		}).toEqual({ first_result: true, second_result: true, iterator_calls: 1 });
	});


	test('reports unreachable Python files and follows relative imports', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-unused-python-', {
			'tools/coding-lint/entry.py': 'from .reachable import value\n\nif __name__ == "__main__":\n    print(value)\n',
			'tools/coding-lint/reachable.py': 'value = 1\n',
			'tools/coding-lint/unused.py': 'value = 2\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations.map(violation => violation.file)).toEqual(['tools/coding-lint/unused.py']);
	});

	test('keeps Python test files as entry points', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-unused-python-test-', {
			'tools/coding-lint/example.test.py': 'def test_example():\n    assert True\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations).toEqual([]);
	});

	test('recognizes Python main guards as entry points', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-python-main-entry-', {
			'tools/webmcp_proxy.py': 'from tools.webmcp.module import value\n\nif __name__ == "__main__":\n    print(value)\n',
			'tools/webmcp/__init__.py': '',
			'tools/webmcp/module.py': 'value = 1\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations).toEqual([]);
	});

	test('does not treat an ordinary Python module as an entry point', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-python-module-entry-', {
			'tools/webmcp/module.py': 'value = 1\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations.map(violation => violation.file)).toEqual(['tools/webmcp/module.py']);
	});

	test('resolves Python sibling imports when reporting missing imports', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-python-imports-', {
			'tools/coding-lint/importer.py': 'from .dependency import value\n',
			'tools/coding-lint/dependency.py': 'value = 1\n',
		}, root => unused_code.collect_unused_files(root, {
			...SOURCE_OPTIONS,
			entry_files: ['tools/coding-lint/index.ts'],
		}));
		expect(violations.filter(item => item.rule_id === 'missing-import')).toEqual([]);
	});

	test('resolves Python absolute imports inside project packages', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-python-absolute-imports-', {
			'tools/coding-lint/index.py': 'from webmcp.core.shared import value\n',
			'tools/webmcp/core/shared.py': 'value = 1\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations.filter(item => item.rule_id === 'missing-import')).toEqual([]);
	});

	test('resolves Python absolute imports to package initializers', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-python-package-imports-', {
			'tools/coding-lint/index.py': 'from webmcp.core.shared import value\n',
			'tools/webmcp/core/shared/__init__.py': 'value = 1\n',
		}, root => unused_code.collect_unused_files(root, SOURCE_OPTIONS));
		expect(violations.filter(item => item.rule_id === 'missing-import')).toEqual([]);
	});

	test('accepts a file imported outside the entry-point graph', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-unused-code-imported-', {
			'tools/coding-lint/index.ts': 'export const entry = 1;\n',
			'tools/coding-lint/importer.ts': "export { value } from './dependency';\n",
			'tools/coding-lint/dependency.ts': 'export const value = 1;\n',
		}, root => unused_code.collect_unused_files(root, {
			...SOURCE_OPTIONS,
			entry_files: ['tools/coding-lint/index.ts'],
		}));
		expect(violations.map(violation => violation.file)).toEqual(['tools/coding-lint/importer.ts']);
	});

	test('reports unresolved relative imports', () => {
		const unused_code = new UnusedCode();
		const violations = fixture.with_temporary_files('webmcp-unused-code-missing-import-', {
			'tools/coding-lint/index.ts': "import './deleted-module';\n",
		}, root => unused_code.collect_unused_files(root, {
			...SOURCE_OPTIONS,
			entry_files: ['tools/coding-lint/index.ts'],
		}));
		expect(violations).toEqual([
			expect.objectContaining({
				file: 'tools/coding-lint/index.ts',
				rule_id: 'missing-import',
				message: 'Relative import cannot be resolved: ./deleted-module',
			}),
		]);
	});
});
