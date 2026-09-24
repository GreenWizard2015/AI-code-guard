import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint type boundary rules', () => {
	test('reports all TypeScript names with the same sorted field shape', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'duplicate-types.ts': [
				'type JsonResponse = { content: Record<string, unknown>; };',
				'type TextResponse = { content: Record<string, unknown>; };',
				'type ReorderedResponse = { value: string; content: Record<string, unknown>; };',
				'type DifferentResponse = { content: string; };',
			].join('\n'),
		});

		expect(violations).toContainEqual(expect.objectContaining({
			rule_id: 'duplicate-type-shape',
			message: 'duplicate type shape: JsonResponse, TextResponse',
		}));
	});

	test('reports Python classes with the same field shape', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'duplicate-types.py': [
				'from dataclasses import dataclass',
				'@dataclass',
				'class CompletionContext:',
				'    tab_id: str',
				'    call_id: str',
				'    result: str',
				'    error: str',
				'@dataclass',
				'class CompletionErrorContext:',
				'    error: str',
				'    result: str',
				'    call_id: str',
				'    tab_id: str',
			].join('\n'),
		});

		expect(violations).toContainEqual(expect.objectContaining({
			rule_id: 'duplicate-type-shape',
			message: 'duplicate type shape: CompletionContext, CompletionErrorContext',
		}));
	});

	test('does not merge Python value wrappers with different native bases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'json-value-states.py': [
				'class JsonObjectState(dict):',
				'    present: bool',
				'class JsonStringState(str):',
				'    present: bool',
				'class JsonListState(list):',
				'    present: bool',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'duplicate-type-shape')).toHaveLength(0);
	});

	test('does not merge TypeScript interfaces with different native bases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'native-base-types.ts': [
				'interface JsonValue extends Record<string, unknown> {',
				'  present: boolean;',
				'}',
				'interface StringValue extends String {',
				'  present: boolean;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'duplicate-type-shape')).toHaveLength(0);
	});

	test('requires a class contract for primitive unions at boundaries', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'bridge-result.ts': 'type BridgeResult = { stderr: Buffer | string; };',
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'composite-state-type',
				priority: 6,
			})
		);
	});

	test('rejects fields typed as nullish values', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'nullish-fields.ts': [
				'type NullishFields = {',
				'  missing: null;',
				'  absent: undefined;',
				'  impossible: never;',
				'  opaque: unknown;',
				'  unchecked: any;',
				'};',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'nullable-domain-type')).toHaveLength(5);
	});

	test('rejects unbounded TypeScript and Python types everywhere', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'unbounded.ts': [
				'type Unbounded = { value: unknown; fallback: any; };',
				'function read(value: unknown): any { return value; }',
			].join('\n'),
			'unbounded.py': [
				'from typing import Any',
				'class Reader:',
				'    value: Any',
				'    def read(self, value: Any) -> Any:',
				'        return value',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'unbounded-type')).toHaveLength(7);
	});

	test('rejects TypeScript markdown boundary examples', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'markdown-boundaries.ts': [
				'type Boundary = { value: unknown; payload: Record<string, object>; };',
				'const module_value: any = {};',
				'class Reader {',
				'  public field: object;',
				'  public read(value: any): object {',
				'    const local: unknown = value;',
				'    return local;',
				'  }',
				'}',
			].join('\n'),
		});

		const unbounded = violations.filter(item => item.rule_id === 'unbounded-type');
		expect(unbounded).toHaveLength(6);
		expect(unbounded.filter(item => item.line === 6)).toHaveLength(0);
	});

	test('rejects Python markdown boundary examples', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'markdown-boundaries.py': [
				'from typing import Any',
				'bridge_result: dict[str, Any] = {}',
				'class Reader:',
				'    field: object',
				'    def read(self, value: Any) -> object:',
				'        local: Any = value',
				'        return value',
				'schema: TypeAlias = dict[str, Any]',
			].join('\n'),
		});

		const unbounded = violations.filter(item => item.rule_id === 'unbounded-type');
		expect(unbounded).toHaveLength(5);
		expect(unbounded.filter(item => item.line === 6)).toHaveLength(0);
	});

	test('rejects undefined checks for required fields', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'required-field-check.ts': [
				'type Parsed = { attribute_accesses: string[] };',
				'function has_attributes(parsed: Parsed): boolean {',
				'  return parsed.attribute_accesses === undefined;',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'unnecessary-undefined-check',
				priority: 5,
			})
		);
	});

	test('rejects optional access to required fields', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'optional-field-access.ts': [
				'type Parsed = { attribute_accesses: string[] };',
				'function has_attributes(parsed: Parsed): boolean {',
				'  return parsed?.attribute_accesses.length > 0;',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'unnecessary-undefined-check',
				priority: 5,
			})
		);
	});

	test('rejects TypeScript is type guards', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'type-guard.ts': [
				'class User {}',
				'function is_user(value: unknown): value is User {',
				'  return value instanceof User;',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: 'typescript-type-guard',
				priority: 5,
			})
		);
	});

	test('rejects unknown parameter types', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'unknown-parameter.ts': 'function parse_value(value: unknown): string { return String(value); }',
		});

		expect(violations).toContainEqual(expect.objectContaining({
			rule_id: 'typescript-unknown-parameter-type',
			priority: 5,
			message: 'parameter "value" must not use unknown',
		}));
	});
});
