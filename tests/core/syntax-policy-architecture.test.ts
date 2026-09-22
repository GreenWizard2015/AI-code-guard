import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { dynamic_import_files, alias_rule_files, alias_test_files } from 'tests/core/constants';

describe('coding-lint syntax and policy rules', () => {
	test('rejects dynamic and nested imports', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(dynamic_import_files);
		const messages = violations.map(violation => violation.message);

		expect(messages.filter(message => message === 'avoid dynamic imports')).toHaveLength(5);
		expect(messages.filter(message => message === 'avoid nested imports')).toHaveLength(1);
	});

	test('rejects imports after module code', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'late.ts': ['export const value = 1;', "import { helper } from './helper';"].join('\n'),
			'late.py': ['value = 1', 'from module import helper'].join('\n'),
		});

		expect(
			messages.filter(message => message === 'imports must be at the beginning of the file')
		).toHaveLength(2);
	});

	test('rejects relative imports in TypeScript and Python', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'relative.ts': [
				"import { value } from './value';",
				"import type { Item } from '../item';",
			].join('\n'),
			'relative.py': [
				'from .value import value',
				'from ..item import Item',
			].join('\n'),
		});

		expect(
			violations.filter(violation => violation.rule_id === 'relative-import')
		).toHaveLength(4);
	});

	test('rejects all direct sys.path mutations but allows reads', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'path.py': [
				'import sys',
				'sys.path.insert(0, "proxy")',
				'def configure():',
				'    sys.path.append("support")',
				'    sys.path[0] = "support"',
				'    sys.path += ["late"]',
				'    sys.path = ["replacement"]',
				'    del sys.path[:1]',
				'    size = len(sys.path)',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'avoid sys.path mutations')).toHaveLength(6);
	});

	test('rejects Object state merging and Object method calls', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'object-hacks.ts': [
				'const target = {};',
				'Object.assign(target, { value: 1 });',
				'Object.prototype.hasOwnProperty.call(target, "value");',
			].join('\n'),
		});

		expect(messages).toContain('avoid Object.assign');
		expect(messages).toContain('avoid Object method .call');
	});

	test('rejects reflective and dynamic runtime APIs', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'dynamic-runtime.ts': [
				'declare const target: Record<string, unknown>;',
				'declare const name_string: string;',
				'Reflect.get(target, "value");',
				'const setter = Reflect.set;',
				'new Proxy(target, handler);',
				'target[name_string];',
				'items[0];',
				'eval(source);',
				'new Function(source);',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid reflective and dynamic runtime APIs')
		).toHaveLength(4);
	});

	test('reports class references outside the definition file by threshold', () => {
		const test_fixture = new TestFixture();

		const files = Object.fromEntries(
			Array.from({ length: 5 }, (_, index) => [
				`reference-${index}.ts`,
				`class Consumer${index} { constructor(dependency: Base) {} }`,
			])
		);
		const messages = test_fixture.violation_messages({
			'base.ts': 'class Base {}',
			...files,
		});

		expect(messages).toContain(
			'class "Base" is referenced from 5 files outside its definition file'
		);
		expect(
			test_fixture.collect_fixture_violations({
				'base.ts': 'class Base {}',
				...files,
			}).find(item => item.message.includes('class "Base" is referenced'))?.rule_id
		).toBe('class-reference-info');
	});

	test('does not count test files as class references', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'base.ts': 'class Base {}',
			'one.ts': 'class ConsumerOne { constructor(dependency: Base) {} }',
			'two.ts': 'class ConsumerTwo { constructor(dependency: Base) {} }',
			'three.ts': 'class ConsumerThree { constructor(dependency: Base) {} }',
			'four.ts': 'class ConsumerFour { constructor(dependency: Base) {} }',
			'base.test.ts': 'class TestConsumer { constructor(dependency: Base) {} }',
		});

		expect(messages).not.toContain(
			'class "Base" is referenced from 5 files outside its definition file'
		);
	});

	test('warns when a class is referenced from fifteen other files', () => {
		const test_fixture = new TestFixture();

		const files = Object.fromEntries(
			Array.from({ length: 15 }, (_, index) => [
				`reference-${index}.ts`,
				`class Consumer${index} { constructor(dependency: Base) {} }`,
			])
		);
		const violations = test_fixture.collect_fixture_violations({
			'base.ts': 'class Base {}',
			...files,
		});

		expect(
			violations.some(
				violation =>
					violation.message ===
						'class "Base" is referenced from 15 files outside its definition file' &&
					violation.priority === 3 &&
					violation.rule_id === 'class-reference-warning'
			)
		).toBe(true);
	});

	test('reports reexports and pointless aliases in both languages', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(alias_rule_files);
		const messages = violations.map(violation => violation.message);
		const test_messages = test_fixture.violation_messages({
			'tests/inline-types.test.ts': alias_test_files['tests/inline-types.test.ts'],
		});
		const test_naming_messages = test_fixture.violation_messages({
			'tests/inline-type-fields.test.ts': alias_test_files['tests/inline-type-fields.test.ts'],
		});
		expect({
			pointless: messages.filter(message => message === 'avoid pointless temporary assignments').length,
			inline_objects: messages.filter(message => message === 'avoid inline object types').length,
			inline_union: messages.includes('avoid inline literal union types'),
			test_inline_object: test_messages.includes('avoid inline object types'),
			test_naming: test_naming_messages.some(message => message.includes('camelCaseFieldWithExtraWords')),
		}).toEqual({ pointless: 9, inline_objects: 2, inline_union: true, test_inline_object: false, test_naming: false });
	});

	test('rejects type-only TypeScript reexports', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'type-reexport.ts': "export type { FacebookDatabase } from './database';\n",
		});

		expect(
			violations.filter(
				violation =>
					violation.message ===
					'avoid re-exporting imported symbols: use the defining module directly instead of re-exporting it'
			)
		).toHaveLength(1);
	});

});
