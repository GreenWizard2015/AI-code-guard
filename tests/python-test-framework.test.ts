import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python test framework consistency', () => {
	test('requires unittest in every Python test file', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_one_test.py': 'def test_one():\n    return True\n',
			'tests/pytest_two_test.py': 'def test_two():\n    return True\n',
			'tests/unittest_test.py': [
				'import unittest',
				'',
				'class TestValue(unittest.TestCase):',
				'    def test_value(self):',
				'        self.assertTrue(True)',
			].join('\n'),
		});

		expect(
			violations.filter(item => item.rule_id === 'python-test-framework-consistency')
		).toHaveLength(2);
		expect(
			violations.find(item => item.rule_id === 'python-test-framework-consistency')?.message
		).toBe('use unittest in every Python test file');
	});

	test('does not report a project whose Python tests use unittest', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/one_test.py': [
				'import unittest',
				'class TestOne(unittest.TestCase):',
				'    def test_one(self):',
				'        self.assertTrue(True)',
			].join('\n'),
			'tests/two_test.py': [
				'import unittest',
				'class TestTwo(unittest.TestCase):',
				'    def test_two(self):',
				'        self.assertTrue(True)',
			].join('\n'),
		});

		expect(violations).not.toContainEqual(
			expect.objectContaining({ rule_id: 'python-test-framework-consistency' })
		);
	});

	test('rejects pytest test classes even without inheritance', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_test.py': [
				'import pytest',
				'class TestValue:',
				'    def test_value(self):',
				'        return True',
			].join('\n'),
		});

		expect({
			framework_violation_count: violations.filter(item => item.rule_id === 'python-test-framework-consistency').length,
			framework_message: violations.find(item => item.rule_id === 'python-test-framework-consistency')?.message,
			inheritance_violation_count: violations.filter(item => item.rule_id === 'python-test-class-inheritance').length,
		}).toEqual({
			framework_violation_count: 1,
			framework_message: 'use unittest in every Python test file',
			inheritance_violation_count: 1,
		});
	});

	test('rejects pytest inheritance from a local helper', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_test.py': [
				'class ProxyTestBase:',
				'    pass',
				'class TestValue(ProxyTestBase):',
				'    def test_value(self):',
				'        return True',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: 'python-test-class-inheritance' })
		);
	});

	test('rejects pytest inheritance from any helper class', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_test.py': [
				'class Helper:',
				'    pass',
				'class TestValue(Helper):',
				'    def test_value(self):',
				'        return True',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: 'python-test-class-inheritance' })
		);
	});

	test('keeps the unittest framework base contract', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/unittest_test.py': [
				'import unittest',
				'class TestValue:',
				'    def test_value(self):',
				'        return True',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: 'python-test-class-inheritance' })
		);
	});

	test('rejects multiple test class bases', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_test.py': [
				'import pytest',
				'class TestValue(pytest.TestCase, pytest.OtherBase):',
				'    def test_value(self):',
				'        return True',
			].join('\n'),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: 'python-test-class-inheritance' })
		);
	});

	test('rejects self.subTest and recommends parameterized', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/unittest_test.py': [
				'import unittest',
				'class TestValue(unittest.TestCase):',
				'    def test_values(self):',
				'        with self.subTest(value=1):',
				'            self.assertEqual(value, 1)',
			].join('\n'),
		});

		expect({
			count: violations.filter(item => item.rule_id === 'python-test-subtest').length,
			message: violations.find(item => item.rule_id === 'python-test-subtest')?.message,
			hint: violations.find(item => item.rule_id === 'python-test-subtest')?.hint,
		}).toEqual({
			count: 1,
			message: 'Python tests must not use self.subTest',
			hint: 'use parameterized.expand(...) for parameterized cases. Do not: group cases with with self.subTest(...).',
		});
	});
});
