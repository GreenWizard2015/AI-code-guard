import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

	describe('coding-lint test file location rule', () => {
	test('requires test-suffixed files to be below tests', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'feature.test.ts': 'export const feature = 1;',
			'feature_test.py': 'class FeatureTest(unittest.TestCase):\n    pass',
			'tests/feature.test.ts': 'export const feature = 1;',
			'tests/feature_test.py': 'class FeatureTest(unittest.TestCase):\n    pass',
		});
		const location_violations = violations.filter(item => item.rule_id === 'test-file-location');

		expect({
			count: location_violations.length,
			files: location_violations.map(item => item.file.split('/').pop()).sort(),
		}).toEqual({ count: 2, files: ['feature.test.ts', 'feature_test.py'] });
	});

	test('accepts test-suffixed files below tests', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'tests/feature.test.ts': 'export const feature = 1;',
			'tests/feature_test.py': 'class FeatureTest(unittest.TestCase):\n    pass',
		});

		expect(violations.filter(item => item.rule_id === 'test-file-location')).toHaveLength(0);
	});

	test('accepts nested test directories', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'src/tests/feature.test.ts': 'export const feature = 1;',
		});

		expect(violations.filter(item => item.rule_id === 'test-file-location')).toHaveLength(0);
	});
});
