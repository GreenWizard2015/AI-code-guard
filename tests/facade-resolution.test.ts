import { describe, expect, test } from '@jest/globals';
import { CompositionModel } from 'src/bridge/ts/runner/orchestration/runtime/composition/composition-parser';
import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { TypeScriptImportedFunctionAliases } from 'src/typescript-imported-function-aliases';
import { TypeScriptModuleExports } from 'src/module-resolution/resolver';
import { TestFixture } from 'tests/core/test-fixture';
import { join } from 'node:path';
import { typescript_facade_files } from 'tests/constants';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';

describe('coding-lint facade resolution', () => {
	const fixture = new TestFixture();

	test('resolves TypeScript function aliases through index.ts', () => {
		const context_factory = new LintProjectContextCreator();
		const function_aliases = new TypeScriptImportedFunctionAliases();
		const result = fixture.with_temporary_files('coding-lint-facade-', typescript_facade_files, root => {
			const consumer_file = join(root, 'consumer.ts');
			const files = Object.keys(typescript_facade_files).map(file => join(root, file));
			const context = context_factory.lint_context(root, files, new LintStageTimer());
			const source = context.source_record(consumer_file);
			if (source.language !== 'typescript') {
				return { resolved_file: undefined, expected_file: join(root, 'pkg/run.ts') };
			}
			const aliases = function_aliases.imported_function_aliases(source.typescript_ast.source_file);
			return { resolved_file: aliases.get('run')?.source_file, expected_file: join(root, 'pkg/run.ts') };
		});
		expect(result.resolved_file).toBe(result.expected_file);
	});

	test('resolves TypeScript class composition through index.ts', () => {
		const composition_parser = new CompositionModel();
		const result = fixture.with_temporary_files('coding-lint-facade-', typescript_facade_files, root => {
			const consumer_file = join(root, 'consumer.ts');
			const files = Object.keys(typescript_facade_files).map(file => join(root, file));
			const context_factory = new LintProjectContextCreator();
			const context = context_factory.lint_context(root, files, new LintStageTimer());
			const graph = composition_parser.class_graph(context.files());
			const consumer = graph.classes.get(`${consumer_file}:Consumer`);
			return {
				dependencies: consumer?.dependencies,
				expected_dependency: `${join(root, 'pkg/service.ts')}:Service`,
			};
		});
		expect(result.dependencies).toContain(result.expected_dependency);
	});

	test('resolves TypeScript type exports through index.ts', () => {
		const export_resolver = new TypeScriptModuleExports();
		const result = fixture.with_temporary_files('coding-lint-facade-', typescript_facade_files, root => {
			const index_file = join(root, 'pkg/index.ts');
			const resolved = export_resolver.resolve(index_file, 'User');
			return { resolved_file: resolved.file, expected_file: join(root, 'pkg/types.ts') };
		});
		expect(result.resolved_file).toBe(result.expected_file);
	});

	test('resolves Python classes through __init__.py', () => {
		const context_factory = new LintProjectContextCreator();
		const composition_parser = new CompositionModel();
		const result = fixture.with_temporary_files('coding-lint-facade-', {
			'pkg/__init__.py': 'from .service import Service\n',
			'pkg/service.py': 'class Service:\n    pass\n',
			'pkg/consumer.py': 'from . import Service\n\nclass Consumer:\n    def __init__(self):\n        self.service = Service()\n',
		}, root => {
			const files = [
				join(root, 'pkg/__init__.py'),
				join(root, 'pkg/service.py'),
				join(root, 'pkg/consumer.py'),
			];
			const context = context_factory.lint_context(root, files, new LintStageTimer());
			const graph = composition_parser.class_graph(context.files());
			const consumer = graph.classes.get(`${join(root, 'pkg/consumer.py')}:Consumer`);
			return {
				dependencies: consumer?.dependencies,
				expected_dependency: `${join(root, 'pkg/service.py')}:Service`,
			};
		});
		expect(result.dependencies).toContain(result.expected_dependency);
	});
});
