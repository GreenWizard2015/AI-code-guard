import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { ModulePlacementAnalyzer } from 'src/bridge/ts/runner/orchestration/runtime/module-placement';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';



describe('module placement lint', () => {
	test('reports a deep dependency nested under a caller directory', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/c/b/parser.ts': 'export class Parser {}\n',
			'a/c/service.ts': "import { Parser } from './b/parser';\nnew Parser();\n",
			'a/view.ts': "import { Parser } from './c/b/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		const violations = analyzer.collect_violations();
		const first = violations[0];
		expect({
			files: violations.map(item => item.file),
			message: first?.message.includes('Suggested location(s): a/parser.ts or a/parser/parser.ts'),
			hint: first?.hint.includes('a/parser.ts or a/parser/parser.ts'),
		}).toEqual({
			files: ['a/c/b/parser.ts'],
			message: true,
			hint: true,
		});
	});

	test('allows a focused folder distinct from caller folders', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/feature/parser/parser.ts': 'export class Parser {}\n',
			'a/feature/service.ts': "import { Parser } from './parser/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations()).toEqual([]);
	});

	test('skips ignored modules and their importer edges', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/c/b/parser.ts': 'export class Parser {}\n',
			'a/c/service.ts': "import { Parser } from './b/parser';\nnew Parser();\n",
			'a/view.ts': "import { Parser } from './c/b/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const ignored_files = new Set(value.paths.filter(path => path.endsWith('parser.ts')));
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, ignored_files);

		expect(analyzer.collect_violations()).toEqual([]);
	});

	test('uses the importer directory as the common path for one importer', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'x/h.ts': 'export class Handler {}\n',
			'a/b/c/d.ts': "import { Handler } from '../../../x/h';\nnew Handler();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		const violations = analyzer.collect_violations();

		expect(violations.map(item => item.file)).toEqual(['x/h.ts']);
		expect(violations[0].message).toContain(
			'Suggested location(s): a/b/c/h.ts or a/b/c/h/h.ts'
		);
	});

	test('does not use a test-only importer as evidence', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/parser.ts': 'export class Parser {}\n',
			'a/c/parser.test.ts': "import { Parser } from '../parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations()).toEqual([]);
	});

	test('reports a deep dependency in a Python production graph', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/c/b/parser.py': 'class Parser:\n    pass\n',
			'a/c/service.py': 'from .b.parser import Parser\nParser()\n',
			'a/view.py': 'from .c.b.parser import Parser\nParser()\n',
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations().map(item => item.file)).toEqual(['a/c/b/parser.py']);
	});

	test('reports a dependency shared with one nested production importer', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/parser.ts': 'export class Parser {}\n',
			'a/c/service.ts': "import { Parser } from '../parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations().map(item => item.file)).toEqual(['a/parser.ts']);
	});

	test('allows a focused folder for a root-level importer', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/parser.ts': 'export class Parser {}\n',
			'service.ts': "import { Parser } from './a/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations()).toEqual([]);
	});

	test('uses a different focused folder when the module name is a caller folder', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'a/parser/nested/parser.ts': 'export class Parser {}\n',
			'a/parser/service.ts': "import { Parser } from './nested/parser';\nnew Parser();\n",
			'a/view.ts': "import { Parser } from './parser/nested/parser';\nnew Parser();\n",
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		const message = analyzer.collect_violations()[0].message;
		expect(message).toContain('Suggested location(s): a/parser.ts or a/focused/parser.ts');
		expect(message).toContain('Do not place the module in a directory ignored by Git.');
	});

	test('uses a Python package as the placement boundary', () => {
		const test_fixture = new TestFixture();
		const context_factory = new LintProjectContextCreator();

		const value = test_fixture.fixture({
			'pkg/__init__.py': '',
			'pkg/core/shared.py': 'class Shared:\n    pass\n',
			'pkg/core/service.py': 'from .shared import Shared\nShared()\n',
			'launcher.py': 'from pkg.core.shared import Shared\nShared()\n',
		});
		const context = context_factory.lint_context(value.root, value.paths, new LintStageTimer());
		const analyzer = new ModulePlacementAnalyzer(value.root, value.paths, context, new Set<string>());
		expect(analyzer.collect_violations()).toEqual([]);
	});
});
