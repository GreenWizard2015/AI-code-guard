import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

import { complex_assertion_files } from 'tests/bridge/ts/core/constants';
describe('coding-lint test assertion grouping', () => {
	test('groups three or more Jest expectations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/result.test.ts': [
				"describe('result', () => {",
				"  test('many fields', () => {",
				'    const check = expect;',
				'    check(result.name).toBe("Service");',
				'    check(result.base).toEqual(["Record"]);',
				'    check(result.visibility).toBe("private");',
				'  });',
				"  test('one field', () => {",
				'    expect(result.name).toBe("Service");',
				'  });',
				'});',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-assertion-grouping')).toHaveLength(1);
	});

	test('groups three or more unittest assertions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/result_test.py': [
				'import unittest',
				'',
				'class TestResult(unittest.TestCase):',
				'    def test_fields(self):',
				'        self.assertEqual(result["name"], "Service")',
				'        self.assertEqual(result["base"], ["Record"])',
				'        self.assertEqual(result["visibility"], "private")',
				'',
				'    def test_aliased_fields(self):',
				'        check_true, *ignored = (self.assertTrue, None, None)',
				'        check_equal, *ignored = (self.assertEqual, None, None)',
				'        check_true(True)',
				'        check_equal(1, 1)',
				'        self.assertIsNotNone(object())',
				'',
				'    def test_one_field(self):',
				'        self.assertEqual(result["name"], "Service")',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-assertion-grouping')).toHaveLength(2);
	});

	test('rejects indexed unittest assertion aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/indexed_assertion_test.py': [
				'import unittest',
				'',
				'class TestResult(unittest.TestCase):',
				'    def test_fields(self):',
				'        checks = (self.assertTrue, self.assertEqual)',
				'        checks[0](True)',
				'        checks[1](1, 1)',
				'        self.assertIsNotNone(object())',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-assertion-grouping')).toHaveLength(1);
		expect(violations.filter(item => item.rule_id === 'python-test-assertion-alias')).toHaveLength(1);
	});

	test('rejects unittest assertion aliases through static key names', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/dynamic-assertion-key_test.py': [
				'import unittest',
				'class TestResult(unittest.TestCase):',
				'    def test_fields(self):',
				'        checks = {"assert_true": self.assertTrue}',
				'        method_name = "assert_true"',
				'        checks[method_name](True)',
				'        self.assertIsNotNone(object())',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-test-assertion-alias')).toHaveLength(1);
	});

	test('suggests atomic tests after five assertions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(complex_assertion_files);

		expect(violations.filter(item => item.rule_id === 'test-too-many-assertions')).toHaveLength(2);
	});
});
