import { ClassRules } from 'src/bridge/ts/rules/class-rules';
import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { UnusedCode } from 'src/bridge/ts/core/unused-code';
import { TestFixture } from 'tests/core/test-fixture';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { RULES_BY_ID } from 'src/model/constants';
import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { join } from 'node:path';
import { SOURCE_OPTIONS } from 'tests/core/constants';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import { AstModel } from 'src/bridge/ts/core/ast-model';

import { describe, expect, test } from '@jest/globals';

describe('coding lint project context', () => {
	const fixture = new TestFixture();

	test('exposes coding rules through the Rule interface', () => {
		const rule = RULES_BY_ID.get('typescript-console-mock-in-test');
		expect(rule).toBeDefined();
		expect(rule?.violation('fixture.ts', 1, {})).toEqual(
			expect.objectContaining({
				message: 'do not mock console in tests',
				hint: expect.stringContaining('assert the returned value'),
				rule_id: 'typescript-console-mock-in-test',
			})
		);
	});

	test('renders message templates when creating violations', () => {
		const rule = new DiagnosticRule('class-size');
		expect(rule.violation('fixture.ts', 3, { count: '4' })).toEqual({
			file: 'fixture.ts',
			line: 3,
			message: 'class has too many methods (found 4)',
			hint: expect.stringContaining('split the class'),
			rule_id: 'class-size',
			priority: 3,
		});
	});

	test('uses distinct rule IDs for informational and warning variants', () => {
		const info_rule = new DiagnosticRule('type-info');
		const warning_rule = new DiagnosticRule('type-warning');
		const info = info_rule.violation('fixture.ts', 1, { subject: 'return type', type: 'unknown' });
		const warning = warning_rule.violation('fixture.ts', 2, { subject: 'field "value"', type: 'unknown' });
		expect(info).toEqual(expect.objectContaining({ rule_id: 'type-info', priority: 5 }));
		expect(warning).toEqual(expect.objectContaining({ rule_id: 'type-warning', priority: 5 }));
	});

	test('rejects console mocks in tests', () => {
	const source = new TypeScriptAstFile('tests/example.test.ts', "const output = jest.spyOn(console, 'warn');\ntest('output', () => { expect(output).toBeDefined(); });");
	const linter = new CodingRuleLinter(new SourceFileAst({
			file: 'tests/example.test.ts',
			text: "const output = jest.spyOn(console, 'warn');\ntest('output', () => { expect(output).toBeDefined(); });",
		}, source.normalized(), source.source_file));
		const violations = linter.lint();
		expect(violations).toEqual([
			expect.objectContaining({ line: 1, message: 'do not mock console in tests', rule_id: 'typescript-console-mock-in-test' }),
		]);
	});

	test('rejects direct console usage in tests', () => {
	const source = new TypeScriptAstFile('tests/example.test.ts', "console.log('result');\ntest('result', () => { expect(true).toBe(true); });");
	const linter = new CodingRuleLinter(new SourceFileAst({
			file: 'tests/example.test.ts',
			text: "console.log('result');\ntest('result', () => { expect(true).toBe(true); });",
		}, source.normalized(), source.source_file));
		const violations = linter.lint();
		expect(violations).toEqual([
			expect.objectContaining({ line: 1, message: 'do not use console in tests', rule_id: 'typescript-console-in-test' }),
		]);
	});

	test('keeps source records and run-local parse statistics', () => {
		const context_factory = new LintProjectContextCreator();
		const statistics = fixture.with_temporary_files(
			'webmcp-lint-context-',
			{ 'tools/coding-lint/index.ts': 'export const value = 1;\n', 'tools/coding-lint/helper.py': 'value = 1\n' },
			root => context_factory.lint_context(root, [join(root, 'tools/coding-lint/index.ts'), join(root, 'tools/coding-lint/helper.py')], new LintStageTimer()).statistics()
		);
		expect(statistics).toEqual({ source_reads: 2, typescript_parses: 1, python_parses: 1, source_records: 2 });
	});

		test('does not activate the Python bridge for a TypeScript-only context', () => {
		const context_factory = new LintProjectContextCreator();
		const original_path = process.env.PATH;
		process.env.PATH = '';
		const statistics = fixture.with_temporary_files(
			'webmcp-lint-typescript-only-',
			{ 'tools/coding-lint/index.ts': 'export const value: number = 1;\n' },
			root => {
				const file = join(root, 'tools/coding-lint/index.ts');
				return context_factory.lint_context(root, [file], new LintStageTimer()).statistics();
			}
		);
		if (original_path === undefined) {
			delete process.env.PATH;
		} else {
			process.env.PATH = original_path;
		}
		expect(statistics).toEqual({ source_reads: 1, typescript_parses: 1, python_parses: 0, source_records: 1 });
	});

	test('reports aggregate source timing without per-file stages', () => {
		const context_factory = new LintProjectContextCreator();
		const stage_timer = new LintStageTimer();
		const timing = fixture.with_temporary_files('webmcp-lint-source-timing-', {
			'tools/coding-lint/index.ts': 'export const value = 1;\n', 'tools/coding-lint/helper.py': 'value = 1\n',
		}, root => {
			const files = ['index.ts', 'helper.py'].map(name => join(root, 'tools/coding-lint', name));
			stage_timer.measure('startup', () => context_factory.lint_context(root, files, stage_timer));
			return stage_timer.durations();
		}
		);

		const formatted_timing = stage_timer.format();
		expect({
			has_aggregate_timing: timing.some(item => item.name === 'startup.project-context.read-files'),
			has_per_file_timing: timing.some(item => item.name.includes('startup.project-context.read-files.file.')),
			shows_aggregate_timing: formatted_timing.includes('read-files:'),
			shows_per_file_timing: formatted_timing.includes('read-files.file.'),
		}).toEqual({
			has_aggregate_timing: true,
			has_per_file_timing: false,
			shows_aggregate_timing: true,
			shows_per_file_timing: false,
		});
	});

	test('shared TypeScript AST preserves coding-rule output', () => {
		const context_factory = new LintProjectContextCreator();
		const result = fixture.shared_ast_lint_results(context_factory);
		expect(result[0]).toEqual(result[1]);
	});

	test('uses the prepared Python AST without reparsing source text', () => {
		const source_text = 'this is not Python syntax';
		const ast_file = new TypeScriptAstFile('prepared.py', source_text);
		const ast_model = new AstModel();
		const prepared_ast = ast_model.empty_ast_file('python');
		prepared_ast.coding_issues = [{ line: 0, kind: 'python-elif' }];
		const linter = new CodingRuleLinter(new SourceFileAst(
			{ file: 'prepared.py', text: source_text },
			prepared_ast,
			ast_file.source_file,
		));

		expect(linter.lint()).toEqual([
			expect.objectContaining({ line: 1, rule_id: 'python-elif' }),
		]);
	});

	test('shared TypeScript AST preserves cross-file import resolution', () => {
		const context_factory = new LintProjectContextCreator();
		const class_rules = new ClassRules();
		const result = fixture.with_temporary_files('webmcp-lint-import-context-', {
			'tools/coding-lint/helper.ts': 'export function execute(): number { return 1; }\n',
			'tools/coding-lint/model.ts': "import { execute } from './helper';\n\nclass Service {\n  run = execute;\n}\n",
		}, root => {
			const files = [join(root, 'tools/coding-lint/helper.ts'), join(root, 'tools/coding-lint/model.ts')];
			const context = context_factory.lint_context(root, files, new LintStageTimer());
			return [
				class_rules.collect_context_fields({ files, repo_root: root }, context),
				class_rules.collect_field_violations({ files, repo_root: root }),
			];
		});
		expect(result[0]).toEqual(result[1]);
	});

	test('unused-file results are equivalent with the shared context', () => {
		const context_factory = new LintProjectContextCreator();
		const unused_code = new UnusedCode();
		const result = fixture.with_temporary_files('webmcp-lint-unused-context-', {
			'tools/coding-lint/index.ts': "export { value } from './dependency';\n",
			'tools/coding-lint/dependency.ts': 'export const value = 1;\n',
			'tools/coding-lint/unused.ts': 'export const unused = 1;\n',
		}, root => {
			const files = [
				join(root, 'tools/coding-lint/index.ts'),
				join(root, 'tools/coding-lint/dependency.ts'),
				join(root, 'tools/coding-lint/unused.ts'),
			];
			const context = context_factory.lint_context(root, files, new LintStageTimer());
			return [
				unused_code.collect_unused_files(root, {
					context_state: { available: true, value: context },
					entry_files: [],
				}),
				unused_code.collect_unused_files(root, SOURCE_OPTIONS),
			];
		});
		expect(result[0]).toEqual(result[1]);
	});
});
