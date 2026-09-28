import 'src/bridge/ts/core/context-factory';
import 'src/stage-timing';
import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';
import { TestPathSyntax } from 'src/test-path-syntax';

	describe('coding-lint test file location rule', () => {
	test('requires test-suffixed files to be below tests', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'feature.test.ts': 'export const feature = 1;',
			'feature.spec.ts': 'export const feature = 1;',
			'feature_test.py': 'class FeatureTest(unittest.TestCase):\n    pass',
			'test_feature.py': 'class FeatureTest(unittest.TestCase):\n    pass',
		});
		const location_violations = violations.filter(item => item.rule_id === 'test-file-location');

		expect({
			count: location_violations.length,
			files: location_violations.map(item => item.file.split('/').pop()).sort(),
		}).toEqual({ count: 4, files: ['feature.spec.ts', 'feature.test.ts', 'feature_test.py', 'test_feature.py'] });
	});

	test('accepts only root tests and __tests__ directories', () => {
		const syntax = new TestPathSyntax();
		expect({
			tests: syntax.test_file('tests/feature.test.ts', true),
			jest: syntax.test_file('__tests__/feature.spec.ts', true),
			nested_tests: syntax.test_file('src/tests/feature.test.ts', true),
			nested_jest: syntax.test_file('src/__tests__/feature.spec.ts', true),
		}).toEqual({ tests: true, jest: true, nested_tests: false, nested_jest: false });
	});

	test('rejects nested test directories', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'src/tests/feature.test.ts': 'export const feature = 1;',
			'src/__tests__/feature.spec.ts': 'export const feature = 1;',
		});

		expect(violations.filter(item => item.rule_id === 'test-file-location')).toHaveLength(2);
	});

});
