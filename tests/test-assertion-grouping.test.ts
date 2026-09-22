import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

import { complex_assertion_files } from 'tests/constants';
describe('coding-lint test assertion grouping', () => {
	test('groups three or more Jest expectations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/result.test.ts': [
				"describe('result', () => {",
				"  test('many fields', () => {",
				'    expect(result.name).toBe("Service");',
				'    expect(result.base).toEqual(["Record"]);',
				'    expect(result.visibility).toBe("private");',
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
				'    def test_one_field(self):',
				'        self.assertEqual(result["name"], "Service")',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-assertion-grouping')).toHaveLength(1);
	});

	test('suggests atomic tests after five assertions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(complex_assertion_files);

		expect(violations.filter(item => item.rule_id === 'test-too-many-assertions')).toHaveLength(2);
	});
});
