import { ClassRules } from 'src/bridge/ts/rules/class-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { join } from 'node:path';
import ts from 'typescript';

import type { Violation } from 'src/protocols';
import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { TypeScriptAstFile } from 'src/model/typescript-ast';

describe('coding-lint class rules', () => {
	const fixture = new TestFixture();

	test('reports multiple Python top-level classes', () => {
		const class_rules = new ClassRules();

		const pythonViolations: Violation[] = [];
		class_rules.append_python_classes(
			pythonViolations,
			'models.py',
			['class First:', '    pass', '', 'class Second:', '    pass'],
			[],
			false,
		);

		expect(pythonViolations).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test('reports multiple TypeScript top-level classes', () => {
		const class_rules = new ClassRules();
		const tsViolations: Violation[] = [];
		class_rules.append_typescript_classes(
			tsViolations,
			'models.ts',
			['export class First {}', 'class Second {}'],
			ts.createSourceFile(
				'models.ts',
				'export class First {}\nclass Second {}',
				ts.ScriptTarget.Latest,
				true,
			),
			[0, 1],
		);

		expect(tsViolations).toEqual([
			expect.objectContaining({ message: expect.stringContaining('too many top-level classes') }),
		]);
	});

	test('rejects imported functions assigned as Python class fields', () => {
		const class_rules = new ClassRules();
		const violations = fixture.with_temporary_files('coding-lint-', {
			'helper.py': 'def execute():\n    return 1\n\nVALUE = 1\n',
			'model.py': 'from .helper import execute, VALUE\n\nclass Service:\n    run = execute\n    value = VALUE\n',
		}, root => class_rules.collect_field_violations({
			files: [join(root, 'helper.py'), join(root, 'model.py')],
			repo_root: root,
		}));
		expect({
			count: violations.length,
			message: violations[0]?.message.includes('run'),
			line: violations[0]?.line,
		}).toEqual({ count: 1, message: true, line: 4 });
	});

	test('rejects imported functions assigned as TypeScript class fields', () => {
		const class_rules = new ClassRules();
		const violations = fixture.with_temporary_files('coding-lint-', {
			'helper.ts': 'export function execute(): number { return 1; }\nexport const VALUE = 1;\n',
			'model.ts': "import { execute, VALUE } from './helper';\n\nclass Service {\n  run = execute;\n  value = VALUE;\n}\n",
		}, root => class_rules.collect_field_violations({
			files: [join(root, 'helper.ts'), join(root, 'model.ts')],
			repo_root: root,
		}));
		expect({
			count: violations.length,
			message: violations[0]?.message.includes('run'),
			line: violations[0]?.line,
		}).toEqual({ count: 1, message: true, line: 4 });
	});

	test('does not apply production mutability rules to test doubles', () => {
		const source_text = 'class TestElement {\n  id = "";\n  focused = false;\n  focus(): void {\n    this.focused = true;\n  }\n}';
		const ast_file = new TypeScriptAstFile('tests/dom-kit/element.ts', source_text);
		const linter = new CodingRuleLinter(new SourceFileAst(
			{ file: 'tests/dom-kit/element.ts', text: source_text },
			ast_file.normalized(),
			ast_file.source_file,
		));
		const violations = linter.lint();
		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'TypeScript class fields should be readonly',
				}),
				expect.objectContaining({
					message: 'avoid assigning class fields outside constructors',
				}),
			])
		);
	});
});
