import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python unittest assertions', () => {
	test('requires self.assert* assertions for unittest test methods', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'tests/unittest_test.py': [
				'import unittest',
				'',
				'class TestService(unittest.TestCase):',
				'    def test_without_assertion(self):',
				'        value = 1',
				'',
				'    def test_with_assertion(self):',
				'        self.assertEqual(1, 1)',
				'        self.assertTrue(True)',
			].join('\n'),
		});

		const assertion_violations = violations.filter(
			violation => violation.message === 'Python unittest test must contain a direct self.assert* assertion'
		);

		expect(assertion_violations).toHaveLength(1);
		expect(assertion_violations[0]?.line).toBe(4);
	});

	test('rejects unittest tests that only check exceptions', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/exception_test.py': [
				'import unittest',
				'',
				'class TestService(unittest.TestCase):',
				'    def test_only_exception(self):',
				'        self.assertRaises(ValueError, load_service)',
				'',
				'    def test_checks_result(self):',
				'        result = load_service()',
				'        self.assertEqual(result, expected_service)',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-exception-only')).toHaveLength(1);
	});

	test('rejects Python exception-only bypass patterns', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/bypass_test.py': [
				'class TestService:',
				'    def test_manual_catch(self):',
				'        try:',
				'            load_service()',
				'        except ValueError:',
				'            pass',
				'',
				'    def test_error_type(self):',
				'        try:',
				'            load_service()',
				'        except Exception as error:',
				'            assert isinstance(error, ValueError)',
				'',
				'    def test_raised_flag(self):',
				'        raised = False',
				'        try:',
				'            load_service()',
				'        except ValueError:',
				'            raised = True',
				'        assert raised',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'test-exception-only')).toHaveLength(3);
	});

	test('requires assertions at test level in a final consecutive block', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'tests/unittest_test.py': [
				'import unittest',
				'',
				'class TestService(unittest.TestCase):',
				'    def test_nested_assertion(self):',
				'        if True:',
				'            self.assertEqual(1, 1)',
				'        self.assertEqual(1, 1)',
				'',
				'    def test_not_at_end(self):',
				'        self.assertEqual(1, 1)',
				'        value = 1',
			].join('\n'),
		});

		expect({
			missing_direct_assertion: violations.filter(item => item.rule_id === 'python-test-assert').length,
			ending: violations.filter(item => item.rule_id === 'python-test-assert-ending').length,
		}).toEqual({ missing_direct_assertion: 0, ending: 2 });
	});

	test('rejects assertions hidden in a Python helper lambda', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/unittest_test.py': 'import unittest\n\nclass TestService(unittest.TestCase):\n    def test_helper(self):\n        check = lambda: self.assertEqual(1, 1)\n        check()\n',
		});
		expect(violations.filter(item => item.rule_id === 'python-test-assert')).toHaveLength(1);
	});

	test('requires Python properties to use explicit methods', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.py': [
				'class Service:',
				'    @property',
				'    def status(self):',
				'        return self.load_status()',
				'',
				'    @cached_property',
				'    def cached_status(self):',
				'        return self.load_status()',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-property')).toHaveLength(1);
	});
});
