import { DirectoryRules } from 'src/bridge/ts/rules/support/directory-rules';
import { TestFixture } from 'tests/core/test-fixture';
import { join } from 'node:path';




describe('coding-lint directory rules', () => {
	const fixture = new TestFixture();

	test('allows empty directories and ignores __init__.py', () => {
		const directory_rules = new DirectoryRules();
		const violations = fixture.with_temporary_files('coding-lint-directory-', { 'pkg/__init__.py': '' }, root => ({
			empty: directory_rules.collect_directory_violations([], root, new Map(), new Map()),
			init: directory_rules.collect_directory_violations([join(root, 'pkg/__init__.py')], root, new Map(), new Map()),
		}));
		expect(violations.empty).toEqual([]);
		expect(violations.init).toEqual([]);
	});

	test('requires 3 to 40 files in a non-empty leaf directory', () => {
		const directory_rules = new DirectoryRules();
		const counts = [2, 3, 40, 41];
		const files = Object.fromEntries(
			counts.flatMap(count => Array.from({ length: count }, (_, index) => [`pkg-${count}/${index}.ts`, 'export {};\n']))
		);
		const violations = fixture.with_temporary_files('coding-lint-directory-', files, root => counts.map(count => {
			const directory = join(root, `pkg-${count}`);
			const paths = Array.from({ length: count }, (_, index) => join(directory, `${index}.ts`));
				return directory_rules.collect_directory_violations(paths, root, new Map(), new Map());
		}));
		expect({
			minimum: violations[0]?.[0]?.rule_id === 'directory-min-size',
			three: violations[1],
			forty: violations[2],
			maximum: violations[3]?.[0]?.rule_id === 'directory-max-size',
		}).toEqual({ minimum: true, three: [], forty: [], maximum: true });
	});
});
