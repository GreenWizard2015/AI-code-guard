import { describe, expect, test } from '@jest/globals';
import { method_group_sources, method_sources } from 'tests/constants';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint method and type rules', () => {
	test('requires explicit Python return, parameter, and field types', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'annotations.py': [
				'def load(value):', '    return value', '', 'class Service:',
				'    field = 1', '', '    def run(self, value):', '        return value',
			].join('\n'),
		});
		expect({
			returns: violations.filter(item => item.rule_id === 'explicit-return-type').length,
			parameters: violations.filter(item => item.rule_id === 'python-explicit-parameter-type').length,
			fields: violations.filter(item => item.rule_id === 'python-explicit-field-type').length,
	}).toEqual({ returns: 2, parameters: 2, fields: 1 });
	});

	test('requires explicit result types for named TypeScript callables', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'callables.ts': [
				'function load(value: string) { return value; }',
				'const build = (value: string) => value;',
				'class Service {',
				'\tpublic run() { return 1; }',
				'\tpublic get value() { return 1; }',
				'}',
				'interface Contract { fetch(): string; missing(); }',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'explicit-return-type')).toHaveLength(5);
	});

	test('requires long logical chains to use a named condition', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'conditions.ts': 'function ready(a: boolean, b: boolean, c: boolean, d: boolean): boolean { return a && b && c && d; }',
			'conditions.py': 'def ready(a: bool, b: bool, c: bool, d: bool) -> bool:\n    return a and b and c and d',
		});

		expect(violations.filter(item => item.rule_id === 'logical-chain-size')).toHaveLength(2);
	});


	test('reviews shared public method naming patterns in Python and TypeScript', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(method_sources);
		expect({
			result: violations.filter(item => item.rule_id === 'method-get-name').length,
			set: violations.filter(item => item.rule_id === 'method-set-name').length,
			set_message: violations
				.filter(item => item.rule_id === 'method-set-name')
				.every(item => item.message === 'public method uses a storage-shaped setter name'),
			vague: violations.filter(item => item.rule_id === 'method-process-name').length,
			compound: violations.filter(item => item.rule_id === 'method-and-name').length,
			boolean: violations.filter(item => item.rule_id === 'boolean-query-name').length,
			long: violations.filter(item => item.rule_id === 'method-long-name').length,
		}).toEqual({ result: 2, set: 2, set_message: true, vague: 2, compound: 2, boolean: 0, long: 1 });
	});

	test('does not enforce method contracts in relative test paths', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/framework-overrides.ts': [
				'class Handler {',
				'\tpublic getKeyRange(): string { return ""; }',
				'\tpublic setUp(): void {}',
				'}',
			].join('\n'),
		});
		expect(violations.filter(item => item.rule_id.startsWith('method-'))).toHaveLength(0);
	});

	test('assigns a distinct rule to every naming group', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(method_group_sources);
		const rule_ids = new Set(violations.map(item => item.rule_id));
		expect([
			'method-get-name', 'method-find-fetch-lookup-name', 'method-load-read-open-name',
			'method-calculate-compute-name', 'method-create-build-generate-name',
			'method-parse-convert-transform-name', 'method-set-name', 'method-process-name',
			'method-handle-name', 'method-execute-perform-do-name', 'method-and-name',
			'method-long-name', 'boolean-is-name', 'boolean-exists-name',
			'boolean-equals-name', 'boolean-has-can-name',
		].every(rule_id => rule_ids.has(rule_id))).toBe(true);
	});

	test('allows six CamelCase words and reports seven', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'camel-case.ts': [
				'class Catalog {',
				'\tpublic oneTwoThreeFourFiveSix(): string { return ""; }',
				'\tpublic oneTwoThreeFourFiveSixSeven(): string { return ""; }',
				'\tpublic TestForAcronymsUNExample(): string { return ""; }',
				'\tpublic TestForAcronymsUNExampleWithOne(): string { return ""; }',
				'}',
			].join('\n'),
		});
		expect(violations.filter(item => item.rule_id === 'method-long-name')).toHaveLength(2);
	});

	test('rejects TypeScript static fields but keeps static methods separate', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'static-fields.ts': [
				'class SessionStore {',
				'\tprivate static readonly sessions = new Map<string, string>();',
				'\tpublic static create(): SessionStore { return new SessionStore(); }',
				'}',
			].join('\n'),
		});

		expect({
			fields: violations.filter(item => item.rule_id === 'typescript-static-field').length,
			methods: violations.filter(item => item.rule_id === 'typescript-static-method').length,
		}).toEqual({ fields: 1, methods: 1 });
	});

	test('allows expect only inside TypeScript test callbacks', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'src/production.ts': [
				'assert(value);',
				'expect(value).toBe(true);',
				'assert.equal(value, true);',
			].join('\n'),
			'tests/assertions.ts': [
				'expect(value).toBe(true);',
				'test("value", () => { expect(value).toBe(true); });',
			].join('\n'),
		});

		expect({
			count: violations.filter(item => item.rule_id === 'assertion-outside-test').length,
			production: violations.some(
				item => item.rule_id === 'assertion-outside-test' && item.file.endsWith('src/production.ts')
			),
			test_file: violations.some(
				item => item.rule_id === 'assertion-outside-test' && item.file.endsWith('tests/assertions.ts')
			),
		}).toEqual({ count: 1, production: false, test_file: true });
	});

	test('allows Python assertions only inside test functions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'production.py': 'def validate(value: bool) -> None:\n    assert value\n\nclass Validator:\n    def validate(self, value: bool) -> None:\n        self.assertEqual(value, True)',
			'tests/assertions_test.py': 'import unittest\n\nassert module_value\n\nclass TestAssertions(unittest.TestCase):\n    def test_value(self):\n        assert value\n        self.assertEqual(value, True)',
		});

		expect({
			count: violations.filter(item => item.rule_id === 'assertion-outside-test').length,
			production: violations.some(
				item => item.rule_id === 'assertion-outside-test' && item.file.endsWith('production.py')
			),
			test_file: violations.some(
				item => item.rule_id === 'assertion-outside-test' && item.file.endsWith('tests/assertions_test.py')
			),
		}).toEqual({ count: 1, production: false, test_file: true });
	});

	test('rejects in checks for values that are not typed collections', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'map-in.ts': 'if (key in notMap) { return; }',
		});

		expect(violations.filter(item => item.rule_id === 'typescript-in-operator')).toHaveLength(1);
	});

	test('allows in checks only for explicitly typed collections', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'collection-in.ts': [
				'const values: Map<string, string> = new Map();',
				'if (key in values) { return; }',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-in-operator')).toHaveLength(0);
	});

	test('allows data-only object literals under the fake-object rule', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'payload.ts': [
				'const payload = {',
				'\ttext: "value",',
				'\tcount: 1,',
				'};',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-fake-object')).toHaveLength(0);
	});

	test('rejects dynamic own-property checks', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'property-check.ts': 'if (Object.prototype.hasOwnProperty.call(value, key)) { return; }',
		});

		expect(violations.filter(item => item.rule_id === 'typescript-dynamic-runtime-usage')).toHaveLength(1);
	});

	test('allows non-callable serializer payloads to return wire object literals', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'contracts.ts': 'export interface Payload { text: string; }',
			'serializer.ts': [
				'class Serializer {',
				'	private readonly text: string = "value";',
				'	public to_json(): Payload { return { text: this.text }; }',
				'	public to_response(): Payload { return { text: this.text }; }',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'typescript-object-literal-return')).toHaveLength(0);
	});
});
