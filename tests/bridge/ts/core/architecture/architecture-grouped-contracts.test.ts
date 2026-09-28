import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { grouped_protocol_files, composition_files } from 'tests/core/constants';
import { FileFunctionCountReporter } from 'src/bridge/ts/runner/orchestration/runtime/file-function-count-reporter';
import { LintFileName } from 'src/bridge/ts/core/context/file-name';
import type { Violation } from 'src/protocols';

describe('coding-lint architecture and metrics rules - grouped contracts', () => {
	test('allows small files with grouped protocol contracts', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(grouped_protocol_files);

		expect({
			short: violations.some(item => item.message === 'file is too short'),
			protocol: violations.some(item =>
				item.message === 'small file contains a protocol contract' && item.priority === 2
			),
			multiple_classes: violations.some(item => item.message === 'file contains too many top-level classes'),
		}).toEqual({ short: false, protocol: false, multiple_classes: false });
	});

	test('suggests grouping a lone exception class', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'single-error.ts': 'export class SingleError extends Error {}',
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'exception class should be colocated with its caller',
				priority: 7,
			})
		);
	});

	test('does not suggest exception grouping when the caller is colocated', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'agent-response.ts': [
				'export class AgentValidationError extends Error {}',
				'export function parse_agent_response(): void {}',
			].join('\n'),
		});

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'exception class should be colocated with its caller',
				}),
			])
		);
	});

	test('allows small dataclass and exception files', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'small-data.py': [
				'from dataclasses import dataclass',
				'',
				'@dataclass',
				'class SmallData:',
				'    value: str',
			].join('\n'),
			'small-error.ts': 'export class SmallError extends Error {}',
		});

		expect(
			violations.filter(
				violation =>
					(violation.file === 'small-data.py' || violation.file === 'small-error.ts') &&
					violation.message.includes('file has')
			)
		).toHaveLength(0);
	});

	test('rejects nested classes in TypeScript and Python', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'nested-class.ts': ['class Outer {', '  static Inner = class Inner {};', '}'].join('\n'),
			'nested-class.py': ['class Outer:', '    class Inner:', '        pass'].join('\n'),
		});

		expect(messages).toEqual(expect.arrayContaining(['nested classes are not allowed (1)']));
		expect(
			messages.filter(message => message === 'nested classes are not allowed (1)')
		).toHaveLength(2);
	});

	test('rejects nested classes in functions and object expressions', () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			'nested-expressions.ts': [
				'const create = () => class FunctionInner {};',
				'const holder = { inner: class ObjectInner {} };',
			].join('\n'),
		});

		expect(messages).toContain('nested classes are not allowed (2)');
	});

	test('reports composition deeper than three classes', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages(composition_files);

		expect(messages).toContain(
			'class composition is too deep (found 4 levels): CompositionRoot -> CompositionMiddle -> CompositionLeaf -> CompositionEnd'
		);
	});

	test('reports an informational class refactoring hint above ten functions', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'many-functions.ts': Array.from(
				{ length: 11 },
				(_, index) => `export function function${index}() { return ${index}; }`
			).join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'file has many functions (found 11)',
				priority: 1,
				rule_id: 'file-function-count-info',
			})
		);
	});

	test('limits root functions modules to five functions', () => {
		const reporter = new FileFunctionCountReporter();
		const violations: Violation[] = [];
		reporter.append(violations, 'functions.ts', new LintFileName('functions.ts'), { count: 6, first_line: 0 });
		reporter.append(violations, 'functions.py', new LintFileName('functions.py'), { count: 6, first_line: 0 });

		expect(
			violations.filter(item => item.rule_id === 'file-function-count-warning')
		).toHaveLength(0);
		expect(
			violations.filter(item => item.rule_id === 'functions-file-max-count')
		).toEqual([
			expect.objectContaining({ file: 'functions.ts', message: 'functions file has too many functions (found 6)' }),
			expect.objectContaining({ file: 'functions.py', message: 'functions file has too many functions (found 6)' }),
		]);
	});

	test('rejects type declarations in root functions modules', () => {
		const reporter = new FileFunctionCountReporter();
		const violations: Violation[] = [];
		const declarations = [{ line: 0, name: 'Value' }, { line: 1, name: 'Owner' }];
		reporter.append_type_declarations(violations, 'functions.ts', new LintFileName('functions.ts'), declarations);
		reporter.append_type_declarations(violations, 'functions.py', new LintFileName('functions.py'), declarations);

		expect(violations.filter(item => item.rule_id === 'functions-file-type-declaration')).toHaveLength(4);
	});

});
