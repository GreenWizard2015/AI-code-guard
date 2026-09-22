import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint assertion and exception policy', () => {
	test('rejects bare Python assert statements in tests', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/service_test.py': [
				'import unittest',
				'',
				'class TestService(unittest.TestCase):',
				'    def test_bare_assert(self):',
				'        assert load_service() == expected_service',
				'',
				'    def test_unittest_assert(self):',
				'        self.assertEqual(load_service(), expected_service)',
			].join('\n'),
			'service.py': 'def validate_service():\n    assert service_is_valid',
		});

		expect(
			violations.filter(item => item.rule_id === 'python-test-assert-statement')
		).toHaveLength(1);
		expect(
			violations.find(item => item.rule_id === 'python-test-assert-statement')?.line
		).toBe(5);
	});

	test('rejects raise and throw in TypeScript and Python tests only', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/service.test.ts': 'function load_service(): never { throw new Error("failed"); }',
			'tests/service_test.py': 'def load_service():\n    raise RuntimeError("failed")',
			'service.ts': 'function load_service(): never { throw new Error("failed"); }',
			'service.py': 'def load_service():\n    raise RuntimeError("failed")',
		});
		const exception_violations = violations.filter(item => item.rule_id === 'exception-raising');

		expect({
			count: exception_violations.length,
			typescript_test: exception_violations.some(item => item.file.endsWith('/service.test.ts')),
			python_test: exception_violations.some(item => item.file.endsWith('/service_test.py')),
			typescript_production: exception_violations.some(item => item.file.endsWith('/service.ts')),
			python_production: exception_violations.some(item => item.file.endsWith('/service.py')),
		}).toEqual({
			count: 2,
			typescript_test: true,
			python_test: true,
			typescript_production: false,
			python_production: false,
		});
	});
});
