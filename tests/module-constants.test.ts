import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';
import { mixed_module_declaration_files, oversized_module_files, small_module_declaration_files, unlimited_constant_files } from 'tests/constants';

	describe('coding-lint module constants', () => {
	test('reports module declarations in TypeScript and Python', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(oversized_module_files);

		expect({
			typescript: violations.filter(item => item.rule_id === 'module-constants-separation' && item.file.endsWith('service.ts')).length,
			python: violations.filter(item => item.rule_id === 'module-constants-separation' && item.file.endsWith('service.py')).length,
		}).toEqual({ typescript: 1, python: 1 });
	});

	test('reports module declarations without a size threshold', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(small_module_declaration_files);

		expect({
			typescript: violations.filter(item => item.file.endsWith('service.ts')).map(item => item.rule_id),
			python: violations.filter(item => item.file.endsWith('service.py')).map(item => item.rule_id),
		}).toEqual({
			typescript: expect.arrayContaining(['module-constants-separation', 'module-types-separation', 'module-protocols-separation']),
			python: expect.arrayContaining(['module-constants-separation', 'module-types-separation', 'module-protocols-separation']),
		});
	});

	test('allows unlimited constants file size but rejects non-constant declarations', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(unlimited_constant_files);

		expect({
			typescript_content: violations.filter(item => item.rule_id === 'constants-file-content' && item.file.endsWith('constants.ts')).length,
			python_content: violations.filter(item => item.rule_id === 'constants-file-content' && item.file.endsWith('constants.py')).length,
			typescript_max: violations.some(item => item.file.endsWith('constants.ts') && item.rule_id === 'file-max-size'),
		}).toEqual({ typescript_content: 3, python_content: 3, typescript_max: false });
	});

	test('suggests the sibling constants file', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'a/b/service.ts': 'const OPTIONS = {\n  first: true,\n  second: true,\n  third: true,\n  fourth: true,\n  fifth: true,\n  sixth: true,\n  seventh: true,\n  eighth: true,\n  ninth: true,\n  tenth: true,\n  eleventh: true,\n  twelfth: true,\n  thirteenth: true,\n  fourteenth: true,\n  fifteenth: true,\n};',
		});

		expect({
			dedicated: violations.some(item => item.message.includes('/a/b/constants.ts')),
			focused: violations.some(item => item.message.includes('or a focused file')),
		}).toEqual({ dedicated: true, focused: true });
	});

	test('reports all module declarations in ordinary files', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations(mixed_module_declaration_files);

		expect({
			typescript: violations.filter(item => item.file.endsWith('service.ts')).map(item => item.rule_id),
			python: violations.filter(item => item.file.endsWith('service.py')).map(item => item.rule_id),
		}).toEqual({
			typescript: expect.arrayContaining(['module-constants-separation', 'module-types-separation', 'module-protocols-separation']),
			python: expect.arrayContaining(['module-constants-separation', 'module-types-separation', 'module-protocols-separation']),
		});
	});
});
