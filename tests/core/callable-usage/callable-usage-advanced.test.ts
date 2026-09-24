import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { structural_alias_files } from 'tests/core/constants';


describe('coding-lint callable usage rule', () => {
	test('does not report methods implementing an interface declared in another file', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'contract.ts': ['export interface ServicePort { run(): void; }'].join('\n'),
			'service.ts': [
				"import type { ServicePort } from './contract';",
				'export class Service implements ServicePort {',
				'  run() {}',
				'}',
			].join('\n'),
			'one.ts': [
				"import { Service } from './service';",
				'const service = new Service();',
				'service.run();',
			].join('\n'),
		});

		expect(violations.some(violation => violation.message.includes('method "Service.run"'))).toBe(
			false
		);
	});

	test('resolves structural methods through nested port types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export interface AgentPort { load(): void; }',
				'export type Runtime = { agent: AgentPort };',
				'export class AgentService {',
				'  load() {}',
				'}',
			].join('\n'),
			'one.ts': [
				"import type { Runtime } from './source';",
				'declare const runtime: Runtime;',
				'runtime.agent.load();',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				violation.message.includes('method "AgentService.load" has insufficient production usage (found 0')
			)
		).toBe(false);
	});

	test('resolves methods through fields of imported classes', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'leaf.ts': ['export class Leaf {', '  run(): void {}', '}'].join('\n'),
			'holder.ts': [
				"import type { Leaf } from './leaf';",
				'export class Holder {',
				'  readonly leaf: Leaf;',
				'  constructor(leaf: Leaf) {',
				'    this.leaf = leaf;',
				'  }',
				'}',
			].join('\n'),
			'caller.ts': [
				"import { Holder } from './holder';",
				"import { Leaf } from './leaf';",
				'const holder = new Holder(new Leaf());',
				'holder.leaf.run();',
			].join('\n'),
		});

		expect(
			violations.some(violation =>
				violation.message.includes('method "Leaf.run" has insufficient production usage (found 0 other production files')
			)
		).toBe(false);
	});

	test('resolves all references through one nested ownership graph', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'export interface ReaderPort { read(): void; }',
				'export type ReaderState = { reader: ReaderPort };',
				'export class Reader {',
				'  read() {}',
				'}',
			].join('\n'),
			'one.ts': [
				"import type { ReaderState } from './source';",
				'declare const state: ReaderState;',
				'state.reader.read();',
				'state.reader.read();',
			].join('\n'),
			'two.ts': [
				"import type { ReaderState } from './source';",
				'declare const state: ReaderState;',
				'state.reader.read();',
			].join('\n'),
		});

		expect(violations.some(violation => violation.message.includes('method "Reader.read"'))).toBe(
			false
		);
	});

	test('resolves methods called through imported singleton instances', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'tools.ts': [
				'export class Tools {',
				'  normalize() { return 1; }',
				'}',
				'export const TOOLS = new Tools();',
			].join('\n'),
			'one.ts': ["import { TOOLS } from './tools';", 'TOOLS.normalize();'].join('\n'),
			'two.ts': ["import { TOOLS } from './tools';", 'TOOLS.normalize();'].join('\n'),
		});

		expect(
			violations.some(violation => violation.message.includes('method "Tools.normalize" is used'))
		).toBe(false);
	});

	test('resolves constructor properties and structural type aliases', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(structural_alias_files);

		expect(
			violations.some(violation =>
				/method "(Dependency\.run|Consumer\.execute|Panel\.execute)" is used/.test(
					violation.message
				)
			)
		).toBe(false);
	});

});
