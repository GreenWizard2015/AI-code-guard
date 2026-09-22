import { TestFixture } from 'tests/core/test-fixture';
import { TypeScriptScannerClass } from 'src/bridge/ts/runner/orchestration/runtime/typescript-scanner-class';
import { CallableMetrics } from 'src/metrics/callable-metrics';
import type { Violation } from 'src/protocols';
import { LintFileName } from 'src/bridge/ts/core/context/file-name';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import { argument_function_node, short_function_node, short_method_class } from 'tests/core/constants';


describe('AST metric rules', () => {
	test('applies class and method metrics from normalized nodes', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'service.ts', {
			name: 'Service',
			start: 0,
			end: 2,
				methods: [{ name: 'run', start: 1, end: 1, argument_count: 0, characters: 101 }],
			fields: [],
		});

		expect(violations.map(item => item.message)).toEqual(
			expect.arrayContaining([
				expect.stringContaining('class is too short'),
				expect.stringContaining('method is too short'),
			])
		);
	});

	test('applies argument metrics from normalized nodes', () => {
		const test_fixture = new TestFixture();
		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'service.ts', {
			name: 'Service',
			start: 0,
			end: 2,
			methods: [{ name: 'run', start: 1, end: 1, argument_count: 6, characters: 61 }],
			fields: [],
		});

		expect(violations.map(item => item.message)).toEqual(
			expect.arrayContaining([expect.stringContaining('function has too many arguments (found 6)')])
		);
	});

	test('applies function metrics from normalized nodes', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(violations, 'helper.py', argument_function_node, false);
		metrics.append_callable_metrics();

		expect(violations.map(item => item.message)).toEqual(
			expect.arrayContaining([
				expect.stringContaining('function is too short'),
				expect.stringContaining('function has too many arguments (found 6)'),
			])
		);
		expect(violations.every(item => item.line === 5)).toBe(true);
	});

	test('allows functions and methods up to 100 characters despite line minimum', () => {
		const test_fixture = new TestFixture();
		const functionViolations: Violation[] = [];
		const metrics = new CallableMetrics(functionViolations, 'short.ts', short_function_node, false);
		metrics.append_callable_metrics();
		const methodViolations: Violation[] = [];
		test_fixture.append_class_violations(methodViolations, 'Service.ts', short_method_class);

		expect(functionViolations).toEqual([]);
		expect(methodViolations.some(item => item.message.includes('method has'))).toBe(false);
	});

	test('keeps the minimum-line violation above the 100-character boundary', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(
			violations,
			'long-enough.ts',
			{
				name: 'longEnoughFunction',
				start: 4,
				end: 5,
				argument_count: 0,
				characters: 101,
				exception_only: false,
				lines: 2,
				sloc: 2,
				visibility: 'public',
			},
			false
		);
		metrics.append_callable_metrics();

		expect(violations.map(item => item.message)).toContain('function is too short');
	});

	test('does not allow the character exception for private methods', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(
			violations,
			'private.ts',
			{
				name: 'helper',
				start: 4,
				end: 5,
				argument_count: 0,
				lines: 2,
				sloc: 2,
				characters: 100,
				exception_only: false,
				visibility: 'private',
			},
			true
		);
		metrics.append_callable_metrics();

		expect(violations.map(item => item.message)).toContain('method is too short');
	});

	test('ignores a multiline signature when counting body lines', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(
			violations,
			'inline-state.ts',
			{
				name: 'run_edit_flow',
				start: 4,
				end: 20,
				lines: 17,
				sloc: 2,
				argument_count: 2,
				characters: 100,
				exception_only: false,
				visibility: 'public',
			},
			false
		);
		metrics.append_callable_metrics();

		expect(violations).toEqual([]);
	});

	test('uses the combined body-size metric for the maximum size', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(
			violations,
			'large.ts',
			{
				name: 'largeFunction',
				start: 0,
				end: 30,
				lines: 31,
				sloc: 2,
				argument_count: 0,
				characters: 101,
				exception_only: false,
				visibility: 'public',
			},
			false
		);
		metrics.append_callable_metrics();

		expect(violations.map(item => item.message)).toEqual(['function is too long']);
	});

	test('uses the average of body lines and SLOC for minimum size', () => {
		const violations: Violation[] = [];
		const metrics = new CallableMetrics(
			violations,
			'average.ts',
			{
				name: 'averageFunction',
				start: 0,
				end: 2,
				lines: 2,
				sloc: 3,
				argument_count: 0,
				characters: 101,
				exception_only: false,
				visibility: 'public',
			},
			false
		);
		metrics.append_callable_metrics();

		expect(violations.map(item => item.message)).toContain('function is too short');
	});

	test('detects class and function ownership mix from source code', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'mixed.ts': 'class Service { public read(): number { return 1; } }\nfunction build(): number { return 1; }',
		});

		const mixed = violations.filter(violation => violation.rule_id === 'mixed-module');
		expect({
			count: mixed.length,
			line: mixed[0]?.line,
			message: mixed[0]?.message.includes('mixing classes and functions'),
		}).toEqual({ count: 1, line: 1, message: true });
	});

	test('detects mixed ownership for the ignored Facebook API path', () => {
		const file = 'scripts/webpage/src/facebook/facebook-api.ts';
		const text = 'export class Api {}\nexport function create_api() { return new Api(); }';
		const scanner = new TypeScriptScannerClass({
			file_name: new LintFileName(file),
			text,
			project_class_names: new Set(),
			project_type_names: new Set(),
			project_contract_names: new Set(),
			ast_file: new TypeScriptAstFile(file, text),
		});

		scanner.scan_mixed_module();

		expect(scanner.violations.map(violation => violation.message)).toContain(
			'avoid mixing classes and functions in the same file'
		);
	});

});
