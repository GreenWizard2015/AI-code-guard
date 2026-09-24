import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint type boundary edge cases', () => {
	test('allows literal union aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'kinds.ts': ["type First = 'first' | 'second';", "type Second = First | 'third';"].join('\n'),
		});
		expect({
			composite: violations.filter(item => item.rule_id === 'composite-state-type'),
			nullable: violations.filter(item => item.rule_id === 'nullable-domain-type'),
			bypass: violations.filter(item => item.rule_id === 'typescript-union-contract-bypass'),
		}).toEqual({ composite: [], nullable: [], bypass: [] });
	});

	test('allows primitive value unions at method boundaries', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'boundary.ts': 'function load(value: string | number): string { return String(value); }',
		});
		expect({
			composite: violations.filter(item => item.rule_id === 'composite-state-type'),
			nullable: violations.filter(item => item.rule_id === 'nullable-domain-type'),
		}).toEqual({ composite: [], nullable: [] });
	});

	test('keeps composite intersections visible at type boundaries', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'boundary.ts': 'function load(value: A & B): A & B { return value; }',
		});
		expect(violations.filter(item => item.rule_id === 'composite-state-type')).toEqual([
			expect.objectContaining({ rule_id: 'composite-state-type', priority: 6 }),
			expect.objectContaining({ rule_id: 'composite-state-type', priority: 6 }),
		]);
	});

	test('does not treat a single literal as a composite union', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'single.ts': "type Status = 'ready';",
		});
		expect(violations.filter(item => item.rule_id === 'composite-state-type')).toHaveLength(0);
	});

	test('rejects optional parameters in protocol methods and implementations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'protocol.ts': [
				'interface PollingCancellation {',
				'  addEventListener(type: "abort", listener: EventListener, options?: AddEventListenerOptions): void;',
				'}',
				'class NoPollingCancellation implements PollingCancellation {',
				'  addEventListener(_type: "abort", _listener: EventListener, _options?: AddEventListenerOptions): void {}',
				'}',
			].join('\n'),
		});
		expect(violations.filter(item => item.rule_id === 'nullable-domain-type')).toHaveLength(2);
	});

	test('rejects optional parameters in implemented rule methods', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'diagnostic-rule.ts': [
				'interface Rule {',
				'  violation(file: string, line: number, parameters?: RuleParameters): Violation;',
				'}',
				'class DiagnosticRule implements Rule {',
				'  public violation(file: string, line: number, parameters?: RuleParameters): Violation {',
				'    return {} as Violation;',
				'  }',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'nullable-domain-type')).toHaveLength(2);
	});

	test('keeps optional parameters outside contracts visible', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'domain.ts': 'function load(options?: AddEventListenerOptions): void {}',
		});
		expect(violations.filter(item => item.rule_id === 'nullable-domain-type')).toHaveLength(1);
	});

	test('rejects any unions in rest parameters', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'rest-union.ts': [
				'type Context = { value: string };',
				'function collect(...provided: readonly (Context | readonly string[] | undefined)[]): void {}',
				'function collect_arrays(...provided: (Context[] | string[])[]): void {}',
				'function collect_named(...values: readonly string[]): void {}',
			].join('\n'),
		});
		expect(violations.filter(item => item.rule_id === 'typescript-rest-union-contract')).toHaveLength(2);
	});

	test('rejects a zero-index value followed by an undefined guard', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'array-guard.ts': [
				'function read(...parameter_values: readonly string[]): string {',
				'  const parameters = parameter_values[0];',
				'  if (parameters !== undefined) { return parameters; }',
				'  return "";',
				'}',
				'function read_missing(...parameter_values: readonly string[]): string {',
				'  const parameter = parameter_values[0];',
				'  if (parameter === undefined) { return ""; }',
				'  return parameter;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'single-item-array-state')).toHaveLength(2);
	});

	test('rejects explicit TypeScript type assertions but allows const inference', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'assertions.ts': [
				'const first = value as string;',
				'const second = <string>value;',
				'const literal = value as const;',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-type-assertion')).toHaveLength(2);
	});
});
