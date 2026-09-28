import 'src/bridge/ts/parser-internals/type-union-rules/rest-union-contract';
import 'src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

	describe('coding-lint callable feature detection', () => {
		test('rejects callable feature detection through property aliases', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'callable-alias.ts': [
					'const service_run = service.run;',
					'const service_run_alias = service_run;',
					'if (typeof service.run === "function") { return; }',
					'if (typeof service_run_alias === "function") { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(2);
		});

		test('rejects callable feature detection through computed members', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'computed-callable.ts': [
					"const member_name = 'run';",
					"if (typeof service['run'] === 'function') { return; }",
					"if (typeof service[member_name] === 'function') { return; }",
					"if (typeof (service.run) === 'function') { return; }",
					"const function_type = 'function'; if (typeof service.run === function_type) { return; }",
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(4);
		});

		test('rejects parenthesized callable feature detection', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'parenthesized-callable.ts': [
					'if (typeof service.run === "function") { return; }',
					'if ((typeof service.run === "function")) { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(2);
		});

		test('rejects negated callable feature detection', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'negated-callable.ts': [
					'if (typeof service.run === "function") { return; }',
					'if (!(typeof service.run === "function")) { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(2);
		});

		test('rejects Boolean-wrapped callable feature detection', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'boolean-callable.ts': [
					'if (typeof service.run === "function") { return; }',
					'if (Boolean(typeof service.run === "function")) { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(2);
		});

		test('allows primitive type checks', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'primitive-type.ts': 'const count = 1; if (typeof count === "number") { return; }',
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(0);
		});

		test('rejects reversed callable comparisons through aliases', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'reversed-callable.ts': [
					'const service_run = service.run;',
					'if ("function" === typeof service_run) { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(1);
		});

		test('rejects callable feature detection through destructuring', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'destructured-callable.ts': [
					'const { run: service_run } = service;',
					'if (typeof service_run === "function") { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(1);
		});

		test('rejects callable feature detection through array destructuring', () => {
			const fixture = new TestFixture();
			const violations = fixture.collect_fixture_violations({
				'array-destructured-callable.ts': [
					'const [service_run] = [service.run];',
					'if (typeof service_run === "function") { return; }',
				].join('\n'),
			});

			expect(violations.filter(item => item.rule_id === 'python-callable')).toHaveLength(1);
		});
	});
