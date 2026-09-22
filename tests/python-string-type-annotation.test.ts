import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('coding-lint Python string type annotations', () => {
	test('rejects quoted field, parameter, and return annotations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.py': [
				'class Service:',
				'    model: "Model"',
				'',
				'    def load(self, value: "Model") -> "Model":',
				'        return value',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-string-type-annotation')).toHaveLength(3);
	});

	test('allows direct annotations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.py': [
				'class Service:',
				'    model: Model',
				'',
				'    def load(self, value: Model) -> Model:',
				'        return value',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-string-type-annotation')).toHaveLength(0);
	});
});
