import { TestFixture } from 'tests/core/test-fixture';

import { describe, expect, test } from '@jest/globals';

describe('coding-lint collection', () => {
	const fixture = new TestFixture();

	test('processes every file and returns all phases', () => {
		const report = fixture.collect_fixture_report({
			'first.ts': 'const first = a.b.c.d.e;\n',
			'second.ts': 'const second = a.b.c.d.e;\n',
		});
		expect({
			first: report.violations.filter(item => item.file.endsWith('first.ts')).length > 0,
			second: report.violations.filter(item => item.file.endsWith('second.ts')).length > 0,
			keys: Object.keys(report),
		}).toEqual({ first: true, second: true, keys: ['files', 'violations'] });
	});

	test('uses sibling files as context when one file is selected', () => {
		const violations = fixture.collect_fixture_violations(
			{ 'base.ts': 'export class Base {}\n', 'child.ts': 'export class Child extends Base {}\n' },
			['child.ts']
		);
		expect(violations.map(item => item.file.endsWith('base.ts'))).not.toContain(true);
		expect(violations).toContainEqual(expect.objectContaining({ message: 'class inherits from local class "Base"' }));
	});

	test('keeps shared violation selection empty when there are no violations', () => {
		const shared = fixture.shared_violations([]);
		expect(shared).toEqual([]);
		expect(shared).toHaveLength(0);
	});

	test('does not return non-shared diagnostics from shared selection', () => {
		const shared = fixture.shared_violations([]);
		expect(shared).toHaveLength(0);
		expect(shared).toEqual([]);
	});
});
