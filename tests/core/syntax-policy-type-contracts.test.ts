import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { protocol_reference_files } from 'tests/core/constants';
for (let index = 0; index < 5; index += 1) {
	protocol_reference_files[`consumer-${index}.ts`] = ["import type { ServicePort } from './ports';", 'export class Consumer {', '  constructor(private readonly service: ServicePort) {}', '}'].join('\n');
	protocol_reference_files[`consumer-${index}.py`] = ['from protocols import ServicePort', '', 'class Consumer:', '    def __init__(self, service: ServicePort) -> None:', '        self.service = service'].join('\n');
}


describe('coding-lint syntax policy architecture - type contracts', () => {
	test('rejects inline object types used as generic arguments', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'generic-inline-types.ts': [
				'type Result = Promise<{ id: string; value: number }>;',
				'type Items = Array<{ id: string }>;',
			].join('\n'),
			'generic-inline-types.py': [
				'def load(items: list[dict[str, int]]) -> None:',
				'    pass',
			].join('\n'),
		});
		const test_messages = test_fixture.violation_messages({
			'tests/generic-inline-types_test.py': [
				'def load(items: list[dict[str, int]]) -> None:',
				'    pass',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid inline object types in generic arguments')
		).toHaveLength(3);
		expect(test_messages).not.toContain('avoid inline object types in generic arguments');
	});

	test('ignores references to interfaces and protocols', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(protocol_reference_files);

		expect(violations.some(violation => violation.message.includes('class "ServicePort"'))).toBe(
			false
		);
	});

	test('reports TypeScript field assignments outside constructors', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'mutable.ts': [
				'class Service {',
				'  value = 0;',
				'  constructor() { this.value = 1; }',
				'  update() { this.value = 2; }',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'avoid assigning class fields outside constructors',
			})
		);
	});

	test('requires explicit TypeScript member visibility', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'visibility.ts': [
				'class Service {',
				'  value = 0;',
				'  run() { return this.value; }',
				'  private hidden() {}',
				'}',
			].join('\n'),
		});

		expect(
			violations.filter(item => item.message === 'class members must declare visibility explicitly')
		).toHaveLength(2);
	});

	test('ignores explicit visibility checks in TypeScript tests', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'visibility.test.ts': [
				'class TestService {',
				'  value = 0;',
				'  run() { return this.value; }',
				'}',
			].join('\n'),
		});

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: 'class members must declare visibility explicitly',
			})
		);
	});

	test('does not require visibility on object literal methods', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'object.ts': [
				'function create_tools() {',
				'  return {',
				'    run() { return true; },',
				'  };',
				'}',
			].join('\n'),
		});

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: 'class members must declare visibility explicitly',
			})
		);
	});

	test('reports mutable TypeScript fields as information', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'mutable-fields.ts': [
				'class Service {',
				'  public value = 0;',
				'  public readonly stable = 1;',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: 'TypeScript class fields should be readonly',
				priority: 5,
			})
		);
		expect(
			violations.filter(item => item.message === 'TypeScript class fields should be readonly')
		).toHaveLength(1);
	});

	test('reports optional singular/plural fields that may contain aliases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'ast-types.ts': 'type AstClassNode = { base_class_name?: string; base_class_names?: string[]; };',
		});
		expect(violations.filter(item => item.rule_id === 'singular-plural-alias')).toEqual([
			expect.objectContaining({ message: 'optional singular/plural fields may be aliases', priority: 5 }),
			expect.objectContaining({ message: 'optional singular/plural fields may be aliases', priority: 5 }),
		]);
	});

	test('limits TypeScript type fields to ten', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'too-many-fields.ts': [
				'type LargeType = {',
				...Array.from({ length: 11 }, (_, index) => `  field_${index}: string;`),
				'};',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'type-field-count',
				message: 'type has too many fields (found 11)',
			})
		);
	});

	test('limits Python type contract fields to ten', () => {
		const test_fixture = new TestFixture();
		const fields = Array.from({ length: 11 }, (_, index) => `    field_${index}: str`);
		const violations = test_fixture.collect_fixture_violations({
			'too-many-fields.py': ['class LargeType:', ...fields].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'type-field-count',
				message: 'type has too many fields (found 11)',
			})
		);
	});

	test('requires named types for inline literal unions in fields', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'inline-union-field.ts': "type AstCallableReference = { kind: 'function' | 'method'; };",
		});

		expect(violations.filter(item => item.rule_id === 'typescript-inline-union-type')).toHaveLength(1);
	});

	test('rejects arrays used as nullable state', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'array-state.ts': [
				'type Service = { value: string };',
				'function find_service(): Service[] { return []; }',
				'const service = find_service()[1];',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: 'single-item-array-state' })
		);
	});


	test('reports optional fields with named types', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'types.ts': [
				'export type AstStatementNode = {',
				'  kind: AstStatementKind;',
				'  line: number;',
				'  name?: string;',
				'  value_name?: string;',
				'  simple_alias?: boolean;',
				'  destructured?: boolean;',
				'};',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'nullable-domain-type',
				line: 4,
			})
		);
	});

	test('rejects base-or-intersection unions that hide required contract fields', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'report.ts': [
				'type ReportViolationBase = { file: string; line: number; };',
				'type ReportViolation =',
				'  | ReportViolationBase',
				'  | (ReportViolationBase & {',
				'    readonly rule_id: string;',
				'    readonly priority: ViolationPriority;',
				'  });',
			].join('\n'),
		});

		expect(violations).toContainEqual(
				expect.objectContaining({ rule_id: 'typescript-union-contract-bypass', priority: 6 })
		);
	});

	test('requires classes for discriminated state unions', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'result.ts': [
				'type UserLookup =',
				"  | { state: 'found'; user: User }",
				"  | { state: 'not-found'; reason: string };",
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'composite-state-type',
				priority: 6,
			})
		);
	});

});
