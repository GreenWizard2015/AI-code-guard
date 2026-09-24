import { describe, expect, test } from '@jest/globals';
import { LintRunConfiguration } from 'src/bridge/ts/core/lint-run-factory';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { TestFixture } from 'tests/core/test-fixture';

describe('lint run ignored directories', () => {
	const fixture = new TestFixture();

	/** Responsibilities: _execution callback lint-file override_. **/
	const without_lint_file_override = <T>(callback: () => T): T => {
		const original = process.env.CODING_LINT_FILES;
		delete process.env.CODING_LINT_FILES;
		try {
			return callback();
		} finally {
			if (original === undefined) {
				delete process.env.CODING_LINT_FILES;
			} else {
				process.env.CODING_LINT_FILES = original;
			}
		}
	};

	/** Responsibilities: _execution callback configuration lint_. **/
	const with_factory = <T>(callback: (factory: LintRunConfiguration) => T): T => {
		const factory = new LintRunConfiguration();
		try {
			return callback(factory);
		} finally {
			factory.python_ast_worker.close();
		}
	};

	test('does not return ignored files as lint targets', () => {
		const files = fixture.with_temporary_files(
			'webmcp-lint-ignored-target-',
			{
				'kept.ts': 'export const kept = 1;\n',
				'ignored/ignored.ts': 'export const ignored = 1;\n',
			},
			root => without_lint_file_override(() => with_factory(factory => factory.target_files(root, ['ignored'])))
		);

		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/\/kept\.ts$/u);
	});

	test('does not load ignored files into project context', () => {
		const context_files = fixture.with_temporary_files(
			'webmcp-lint-ignored-context-',
			{
				'kept.ts': 'export const kept = 1;\n',
				'ignored/ignored.ts': 'export const ignored = 1;\n',
			},
			root => without_lint_file_override(() => with_factory(factory => {
				const report = factory.lint_report(root, ['ignored'], new LintStageTimer());
				return report.context.files().map(file => file.absolute_path);
			}))
		);

		expect(context_files).toHaveLength(1);
		expect(context_files[0]).toMatch(/\/kept\.ts$/u);
	});
});
