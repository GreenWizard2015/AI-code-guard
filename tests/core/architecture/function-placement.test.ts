import { PlacementSupport } from 'src/bridge/ts/runner/placement-support';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import type { Violation } from 'src/protocols';



describe('function placement rule', () => {
	test('requires TypeScript module functions to live in the project-root functions file', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'worker.ts': 'export function build_worker(): number {\n  return 1;\n}\n',
		});

		expect(
			violations
				.filter(violation => violation.rule_id === 'function-placement')
				.map(violation => ({
					...violation,
					file: violation.file.split('/').pop(),
				}))
		).toEqual([
			expect.objectContaining({
				file: 'worker.ts',
				line: 1,
				message: 'module-level functions must be declared in the project-root functions file',
				priority: 7,
			}),
		]);
	});

	test('requires Python module functions to live in the project-root functions file', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'worker.py': 'def build_worker() -> int:\n    return 1\n',
		});

		expect(
			violations
				.filter(violation => violation.rule_id === 'function-placement')
				.map(violation => ({
					...violation,
					file: violation.file.split('/').pop(),
				}))
		).toEqual([
			expect.objectContaining({
				file: 'worker.py',
				line: 1,
				message: 'module-level functions must be declared in the project-root functions file',
				priority: 7,
			}),
		]);
	});

	test('does not treat class methods as module-level functions', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'worker.ts': 'class Worker {\n  public build(): number {\n    return 1;\n  }\n}\n',
		});

		expect(violations.filter(violation => violation.rule_id === 'function-placement')).toEqual([]);
	});

	test('requires the exact functions filename', () => {
		const placement_support = new PlacementSupport();

		const violations: Violation[] = [];
		const functions = [
			{
				name: 'build_function',
				start: 0,
				end: 2,
				argument_count: 0,
			},
		];

		placement_support.append_function_violations(violations, 'functions.worker.ts', functions);

		expect(violations).toHaveLength(1);
	});

	test('accepts only the exact functions filename', () => {
		const placement_support = new PlacementSupport();

		const violations: Violation[] = [];
		const functions = [
			{
				name: 'build_function',
				start: 0,
				end: 2,
				argument_count: 0,
			},
		];

		placement_support.append_function_violations(violations, 'functions.ts', functions);

		expect(violations).toHaveLength(0);
	});

	test('rejects a functions file nested under a functions directory', () => {
		const placement_support = new PlacementSupport();

		const violations: Violation[] = [];
		const functions = [
			{
				name: 'build_function',
				start: 0,
				end: 2,
				argument_count: 0,
			},
		];

		placement_support.append_function_violations(violations, 'functions/functions.ts', functions);

		expect(violations).toHaveLength(1);
	});

	test('rejects an exact functions filename outside the project root', () => {
		const placement_support = new PlacementSupport();

		const violations: Violation[] = [];
		const functions = [
			{
				name: 'build_function',
				start: 0,
				end: 2,
				argument_count: 0,
			},
		];

		placement_support.append_function_violations(violations, 'src/functions.ts', functions);

		expect(violations).toHaveLength(1);
	});

	test('also checks Python bridge modules', () => {
		const placement_support = new PlacementSupport();

		const violations: Violation[] = [];
		const functions = [
			{
				name: 'build_source_ast',
				start: 10,
				end: 20,
				argument_count: 1,
			},
		];

		placement_support.append_function_violations(
			violations,
			'src/parser/python-bridge/python_ast_bridge.py',
			functions
		);

		expect(violations).toHaveLength(1);
	});
});
