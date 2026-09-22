import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';
import type { ReportViolation } from 'src/bridge/ts/core/types';

describe('coding-lint task reporting', () => {
	/** Responsibilities: _construction task-reporting violation fixture_. **/
	const violation = (
		file: string,
		line: number,
		rule_id: string,
		priority: ReportViolation['priority'],
	): ReportViolation => ({
		file,
		line,
		message: `${rule_id} message`,
		hint: `${rule_id} hint`,
		rule_id,
		priority,
	});
	const reporting_files = {
		'a.ts': 'const first = 1;\nconst second = 2;\nconst third = 3;\n',
		'b.ts': 'const first = 1;\n',
	};
	const reporting_violations = [
		violation('a.ts', 1, 'parse-error', 3),
		violation('a.ts', 2, 'parse-error', 3),
		violation('a.ts', 3, 'class-size', 3),
		violation('a.ts', 1, 'unused-file', 2),
		violation('b.ts', 1, 'parse-error', 3),
		violation('b.ts', 1, 'unused-file', 2),
	];

	test('selects max project priority for files', () => {
		const fixture = new TestFixture();
		const issues = fixture.with_temporary_files('task-reporting-', reporting_files, (_root, reporting) => {
			return reporting.format(reporting_violations, { batch_size: 1, policy: 'top-category' });
		});
		expect(issues).toContain('Total files: 1.');
	});

	test('includes every problem in the selected file', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-reporting-', reporting_files, (root, reporting) => {
			reporting.format(reporting_violations, { batch_size: 1, policy: 'top-category' });
			const issue_document = readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8');
			const report = readFileSync(join(root, '.ai-code-guard', 'report.md'), 'utf8');
			return {
				file: issue_document.includes(`## ${join(root, 'a.ts')}`),
			parse_problem: issue_document.match(/Problem: parse-error message/gu)?.length,
				class_problem: issue_document.includes('Problem: class-size message'),
				unused_problem: issue_document.includes('Problem: unused-file message'),
				line: issue_document.includes('- Line 1: const first = 1;'),
				parse_report: report.includes('| `parse-error` | 3 | 2 |'),
				class_report: report.includes('| `class-size` | 1 | 1 |'),
				unused_report: report.includes('| `unused-file` | 2 | 2 |'),
			};
		});
		expect(result).toEqual({
			file: true,
			parse_problem: 1,
			class_problem: true,
			unused_problem: true,
			line: true,
			parse_report: true,
			class_report: true,
			unused_report: true,
		});
	});

	test('shares identical problems and hints across files', () => {
		const fixture = new TestFixture();
		const document = fixture.with_temporary_files('task-reporting-', reporting_files, (root, reporting) => {
			reporting.format([
				violation('a.ts', 1, 'parse-error', 3),
				violation('b.ts', 1, 'parse-error', 3),
			], { batch_size: 10, policy: 'all' });
			return readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8');
		});
		expect({
			problem_count: document.match(/Problem: parse-error message/gu)?.length,
			hint_count: document.match(/Hint: parse-error hint/gu)?.length,
			first_file: document.match(/## .*a\.ts/gu)?.length,
			second_file: document.match(/## .*b\.ts/gu)?.length,
			all_lines: document.match(/- Line 1:/gu)?.length,
		}).toEqual({ problem_count: 1, hint_count: 1, first_file: 1, second_file: 1, all_lines: 2 });
	});

	test('writes a single problem and hint beside its source line', () => {
		const fixture = new TestFixture();
		const document = fixture.with_temporary_files('task-reporting-', reporting_files, (root, reporting) => {
			reporting.format([violation('a.ts', 1, 'parse-error', 3)], { batch_size: 10, policy: 'all' });
			return readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8');
		});
		const file_section = document.indexOf('## ');
		const source_line = document.indexOf('- Line 1: const first = 1;');
		expect({
			description_problem: document.indexOf('Problem: parse-error message') < file_section,
			description_hint: document.indexOf('Hint: parse-error hint') < file_section,
			line_problem: document.indexOf('Problem: parse-error message') > source_line,
			line_hint: document.indexOf('Hint: parse-error hint') > source_line,
		}).toEqual({ description_problem: false, description_hint: false, line_problem: true, line_hint: true });
	});

	test('keeps unique problems and writes a shared hint once', () => {
		const fixture = new TestFixture();
		const document = fixture.with_temporary_files('task-reporting-', reporting_files, (root, reporting) => {
			reporting.format([
				{ ...violation('a.ts', 1, 'naming', 3), message: 'first name', hint: 'rename the symbol' },
				{ ...violation('b.ts', 1, 'naming', 3), message: 'second name', hint: 'rename the symbol' },
			], { batch_size: 10, policy: 'all' });
			return readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8');
		});
		expect({
			description: document.includes('Description:'),
			first_problem: document.split('Problem: first name').length - 1,
			second_problem: document.split('Problem: second name').length - 1,
			shared_hint: document.split('Hint: rename the symbol').length - 1,
		}).toEqual({ description: false, first_problem: 1, second_problem: 1, shared_hint: 1 });
	});

	test('writes different hints beside their corresponding lines', () => {
		const fixture = new TestFixture();
		const document = fixture.with_temporary_files('task-reporting-', reporting_files, (root, reporting) => {
			reporting.format([
				{ ...violation('a.ts', 1, 'module-placement', 3), hint: 'move a' },
				{ ...violation('b.ts', 1, 'module-placement', 3), hint: 'move b' },
			], { batch_size: 10, policy: 'all' });
			return readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8');
		});
		const first_line = document.indexOf('- Line 1: const first = 1;');
		expect({
			common_hint: document.indexOf('Hint: move a') < first_line,
			first_hint: document.split('Hint: move a').length - 1,
			second_hint: document.split('Hint: move b').length - 1,
		}).toEqual({ common_hint: false, first_hint: 1, second_hint: 1 });
	});

	test('clears stale task files', () => {
		const fixture = new TestFixture();
		const rules = fixture.with_temporary_files('task-batch-', {
			'a.ts': 'const first = 1;\n',
			'b.ts': 'const first = 1;\n',
		}, (root, reporting) => {
			const rules = join(root, '.ai-code-guard', 'rules');
			mkdirSync(rules, { recursive: true });
			writeFileSync(join(rules, 'stale.md'), 'stale');
			reporting.format([], { batch_size: 1, policy: 'all' });
			return readdirSync(rules);
		});
		expect(rules).toEqual([]);
	});

	test('applies the batch size to all selected file problems', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-batch-', {
			'a.ts': 'const first = 1;\n',
			'b.ts': 'const first = 1;\n',
		}, (root, reporting) => {
			const output = reporting.format([
				violation('a.ts', 1, 'parse-error', 3),
				violation('a.ts', 1, 'unused-file', 2),
				violation('b.ts', 1, 'parse-error', 3),
			], { batch_size: 1, policy: 'all' });
			return { output, issue_document: readFileSync(join(root, '.ai-code-guard', 'issues.md'), 'utf8') };
		});
		expect({
			output: result.output.includes('Total files: 1.'),
			unused: result.issue_document.includes('Problem: unused-file message'),
		}).toEqual({ output: true, unused: true });
	});

	test('copies the rule document and writes absolute issue paths', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-docs-', { 'source.ts': 'const result = 1;\n' }, (root, reporting) => {
			reporting.format([violation('source.ts', 1, 'parse-error', 2)], {
				batch_size: 10,
				policy: 'top-category',
			});

			const task_root = join(root, '.ai-code-guard');
			return {
				rule_document: readFileSync(join(task_root, 'rules', 'parse-error.md'), 'utf8'),
				issues: readFileSync(join(task_root, 'issues.md'), 'utf8'),
			};
		});
		expect({
			rule_document: result.rule_document.includes('# `parse-error`'),
			issues: result.issues.includes('## ') && result.issues.includes('/source.ts'),
		}).toEqual({ rule_document: true, issues: true });
	});

	test('prints only total counts when there are no issues', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-clean-', {}, (_root, reporting) => {
			return reporting.format([], { batch_size: 10, policy: 'top-category' });
		});
		expect({
			counts: result.includes('Total issues: 0.\nTotal files: 0.'),
			priority_summary: result.includes('1: 0, 2: 0, 3: 0.'),
		}).toEqual({
			counts: true,
			priority_summary: false,
		});
	});

	test('prints the philosophy and report path when there are no issues', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-clean-', {}, (root, reporting) => {
			const output = reporting.format([], { batch_size: 10, policy: 'top-category' });
			return { root, output, report: readFileSync(join(root, '.ai-code-guard', 'report.md'), 'utf8') };
		});
		expect({
			philosophy: result.output.includes('## Rule philosophy'),
			architecture_review: result.output.includes('A clean lint result does not replace a manual architectural review.'),
			report_path: result.output.includes(`Report in file \`${join(result.root, '.ai-code-guard', 'report.md')}\`.`),
			report: result.report.includes('| — | 0 | 0 |'),
		}).toEqual({ philosophy: true, architecture_review: true, report_path: true, report: true });
	});

	test('requests details for short review notes', () => {
		const fixture = new TestFixture();
		const result = fixture.with_temporary_files('task-review-', {}, (root, reporting) => {
			const review = join(root, '.ai-code-guard', 'review');
			mkdirSync(review, { recursive: true });
			writeFileSync(join(review, 'short.md'), 'too short\n');
			writeFileSync(join(review, 'problem.md'), `${Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n')}\n`);

			const output = reporting.format([], { batch_size: 10, policy: 'top-category' });
			return { output, short_file_exists: existsSync(join(review, 'short.md')) };
		});
		expect({
			output: ['too short', 'Add concrete architectural details', 'Total issues: 2.'].every(value => result.output.includes(value)),
			short_file_exists: result.short_file_exists,
		}).toEqual({ output: true, short_file_exists: true });
	});
});
