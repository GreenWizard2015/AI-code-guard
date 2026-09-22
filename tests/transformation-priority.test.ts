import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import { RULE_DATA } from 'src/parser/ts/constants';
import { TaskFileSelector } from 'src/bridge/ts/core/support/task/task-file-selector';
import { TestFixture } from 'tests/core/test-fixture';

describe('architectural transformation priority', () => {
	test.each([
		'directory', 'directory-class', 'file', 'class', 'callable', 'test', 'typescript-jest',
	])('handles %s minimum size before splitting oversized units', prefix => {
		const minimum = new DiagnosticRule(`${prefix}-min-size`);
		const maximum = new DiagnosticRule(`${prefix}-max-size`);
		const small = minimum.violation('z-small.ts', 1, { count: '1', size: '1', callable: 'method' });
		const large = maximum.violation('a-large.ts', 1, { count: '501', size: '501', callable: 'method' });
		const selector = new TaskFileSelector('/project');
		const first = selector.select_top_category([large, large, small], 1);
		const next = selector.select_top_category([large, large], 1);
		expect({
			priorities: [small.priority, large.priority],
			first: first.files,
			next: next.files,
		}).toEqual({ priorities: [7, 3], first: ['/project/z-small.ts'], next: ['/project/a-large.ts'] });
	});

	test('places modules before resolving imports and splitting files', () => {
		const placement = RULE_DATA['module-placement'].priority;
		const dependent_rules = [
			RULE_DATA['missing-import'], RULE_DATA['relative-import'],
			RULE_DATA['file-max-size'], RULE_DATA['callable-max-size'],
		];
		const comparisons = dependent_rules.map(rule => placement > rule.priority);
		expect(comparisons).toEqual([true, true, true, true]);
	});

	test('keeps directory splits below relocation and above local naming', () => {
		const priorities = [
			RULE_DATA['directory-max-size'].priority,
			RULE_DATA['directory-class-max-size'].priority,
		];
		const relocation = RULE_DATA['module-placement'].priority;
		const naming = RULE_DATA.naming.priority;
		const comparisons = priorities.map(priority => priority < relocation && priority > naming);
		expect(comparisons).toEqual([true, true]);
	});

	test.each(['top-category', 'all'] as const)('%s selects relocation before an import-only file', policy => {
		const fixture = new TestFixture();
		const placement = new DiagnosticRule('module-placement');
		const imports = new DiagnosticRule('missing-import');
		const result = fixture.with_temporary_files('priority-report-', {
			'a-import.ts': 'import { Order } from "./missing";',
			'z-move.ts': 'export class Order {}',
		}, (root, reporting) => {
			const move = placement.violation('z-move.ts', 1, {
				target: 'z-move.ts', importers: 'a-import.ts', placement_message: 'module is misplaced',
				suggestions: 'orders/order.ts', guidance: 'Keep the module with its owner.',
			});
			reporting.format([imports.violation('a-import.ts', 1, { specifier: './missing' }), move], {
				batch_size: 1, policy,
			});
			const document = readFileSync(join(root, '.ai-code-guard/issues.md'), 'utf8');
			return { document, root };
		});
		expect({
			moved_file: result.document.includes(`## ${join(result.root, 'z-move.ts')}`),
			import_file: result.document.includes(`## ${join(result.root, 'a-import.ts')}`),
			destination: result.document.includes('orders/order.ts'),
		}).toEqual({ moved_file: true, import_file: false, destination: true });
	});
});
