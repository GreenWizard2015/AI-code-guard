import 'src/bridge/ts/runner/orchestration/runtime/file-lint';
import 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { describe, expect, test } from '@jest/globals';

import { singleton_files } from 'tests/core/constants';
import { TestFixture } from 'tests/core/test-fixture';

describe('singleton architecture rules', () => {
	test('reports module-level singleton-like instances', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(singleton_files);
		const singleton_violations = violations.filter(item => item.message === 'module-level class instance may be a singleton');
		expect({
			count: singleton_violations.length,
			lines: singleton_violations.map(item => item.line),
		}).toEqual({ count: 15, lines: [2, 6, 9, 2, 3, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2] });
	});

	test('reports module-level singleton assignments', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'assigned-singleton.ts': [
				'class Service {}',
				'let service: Service | undefined;',
				'service = new Service();',
				'export { service };',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports Python singleton constructors nested in wrappers', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'wrapped-singleton.py': [
				'from typing import cast',
				'class Service:',
				'    def run(self) -> None:',
				'        return None',
				'service = cast(Service, Service())',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('reports TypeScript singleton constructors in module control flow', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'conditional-singleton.ts': [
				'class Service { public run(): void {} }',
				'if (process.env.NODE_ENV === "production") {',
				'\tconst service = new Service();',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(1);
	});

	test('allows the explicit TypeScript CLI composition root block', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'cli.ts': [
				'class Service { public run(): void {} }',
				'{',
				'\tconst service = new Service();',
				'\tservice.run();',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(0);
	});

	test('reports instances captured by a module-level callback from a block', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'captured-block-singleton.ts': [
				'class Service { public run(): void {} }',
				'export let run_service: () => void = () => undefined;',
				'{',
				'\tconst service = new Service();',
				'\trun_service = (): void => {',
				'\t\tservice.run();',
				'\t};',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toEqual([
			expect.objectContaining({ line: 4 }),
		]);
	});

	test('allows Python composition roots in module control flow', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'main-singleton.py': [
				'class Service:',
				'    def run(self) -> None:',
				'        return None',
				'if __name__ == "__main__":',
				'    service = Service()',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'singleton')).toHaveLength(0);
	});

	test('reports Python ClassVar as singleton state', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'registry.py': [
				'from typing import ClassVar as CV',
				'ClassVarAlias = ClassVar',
				'class Registry:',
				'    entries: ClassVar[list[str]] = []',
				'    label: typing.ClassVar[str]',
				'    aliases: CV[list[str]] = []',
				'    assigned: ClassVarAlias[list[str]] = []',
				'    name: str',
			].join('\n'),
		});
		expect({
			lines: violations.filter(item => item.rule_id === 'singleton').map(item => item.line),
			ordinary_fields: violations.filter(item => item.rule_id === 'singleton' && item.line === 8).length,
		}).toEqual({ lines: [4, 5, 6, 7], ordinary_fields: 0 });
	});
});
