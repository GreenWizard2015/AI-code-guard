import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { alias_rule_files, alias_test_files } from 'tests/core/constants';


describe('coding-lint syntax and policy rules', () => {
	test('rejects wrapped dynamic runtime keys', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'wrapped-dynamic-runtime.ts': [
				'declare const target: object;',
				'declare const thisArg: object;',
				'declare const args: unknown[];',
				'Reflect["apply"](target, thisArg, args);',
				'Reflect[("apply")](target, thisArg, args);',
				'Reflect["apply" as "apply"](target, thisArg, args);',
				'const method_name = "apply";',
				'Reflect[method_name](target, thisArg, args);',
			].join('\n'),
		});

		expect(
			violations.filter(item => item.rule_id === 'typescript-dynamic-runtime-usage')
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

	test('rejects inline class type descriptions', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'inline-class.ts': [
				'const service = new (class Service { run(): void {} })();',
				'const annotated: { id: string } = { id: "candidate" };',
				'const asserted = value as { id: string };',
				'const satisfied = value satisfies { id: string };',
				'function reader(value: ({ id: string })): void { void value; }',
				'const named: NamedValue = { id: "control" };',
				'type NamedValue = { id: string };',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-inline-object-type')).toHaveLength(5);
	});

	test('rejects multiline Python import facades', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'reexport.py': [
				'from typing import (',
				'    Any as CandidateValue,',
				'    Optional,',
				')',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'reexports')).toHaveLength(1);
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
