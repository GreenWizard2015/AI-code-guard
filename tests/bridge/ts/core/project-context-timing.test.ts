import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LintProjectContextCreator } from 'src/bridge/ts/core/context-factory';
import { LintStageTimer } from 'src/stage-timing';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding lint project context timing', () => {
	const fixture = new TestFixture();

	test('reports aggregate source timing without per-file stages', () => {
		const context_factory = new LintProjectContextCreator();
		const stage_timer = new LintStageTimer();
		const timing = fixture.with_temporary_files('webmcp-lint-source-timing-', {
			'tools/coding-lint/index.ts': 'export const value = 1;\n',
			'tools/coding-lint/helper.py': 'value = 1\n',
		}, root => {
			const files = ['index.ts', 'helper.py'].map(name => join(root, 'tools/coding-lint', name));
			stage_timer.measure('startup', () => context_factory.lint_context(root, files, stage_timer));
			return stage_timer.durations();
		});

		expect({
			has_aggregate_timing: timing.some(item => item.name === 'startup.project-context.read-files'),
			has_per_file_timing: timing.some(item => item.name.includes('startup.project-context.read-files.file.')),
		}).toEqual({ has_aggregate_timing: true, has_per_file_timing: false });
	});

	test('reports Python bridge stage timing', () => {
		const context_factory = new LintProjectContextCreator();
		const stage_timer = new LintStageTimer();
		const timing = fixture.with_temporary_files('webmcp-lint-python-timing-', {
			'tools/coding-lint/helper.py': 'value = 1\n',
		}, root => {
			const file = join(root, 'tools/coding-lint/helper.py');
			stage_timer.measure('startup', () => context_factory.lint_context(root, [file], stage_timer));
			return stage_timer.durations();
		});

		expect({
			has_batch_timing: timing.some(item => item.name.endsWith('batch-source-map')),
			has_round_trip_timing: timing.some(item => item.name.endsWith('bridge-round-trip')),
			has_python_parse_timing: timing.some(item => item.name.endsWith('python-ast-parse')),
			has_python_build_timing: timing.some(item => item.name.endsWith('python-ast-build')),
			has_validation_timing: timing.some(item => item.name.endsWith('response-validation')),
		}).toEqual({
			has_batch_timing: true,
			has_round_trip_timing: true,
			has_python_parse_timing: true,
			has_python_build_timing: true,
			has_validation_timing: true,
		});
	});

	test('formats aggregate source timing', () => {
		const context_factory = new LintProjectContextCreator();
		const stage_timer = new LintStageTimer();
		fixture.with_temporary_files('webmcp-lint-timing-format-', {
			'tools/coding-lint/index.ts': 'export const value = 1;\n',
		}, root => {
			const file = join(root, 'tools/coding-lint/index.ts');
			stage_timer.measure('startup', () => context_factory.lint_context(root, [file], stage_timer));
		});

		const formatted_timing = stage_timer.format();
		expect({
			shows_aggregate_timing: formatted_timing.includes('read-files:'),
			shows_per_file_timing: formatted_timing.includes('read-files.file.'),
		}).toEqual({ shows_aggregate_timing: true, shows_per_file_timing: false });
	});
});
