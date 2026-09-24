import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('Responsibilities documentation rule', () => {
	test('accepts documented TypeScript ownership boundaries', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.ts': [
				'/** Responsibilities: _manage records, cache records_, _expose status_. **/',
				'class Service {',
				'  /** Responsibilities: _manage records_. **/',
				'  run(): void {}',
				'}',
				'type RecordValue = string;',
				'type PrimitiveValue = string | number;',
				"type Status = 'ready';",
				'/** Responsibilities: _load records_. **/',
				'function load(): RecordValue { return ""; }',
				'/** Responsibilities: _expose records_. **/',
				'interface RecordsPort {',
				'  load(): RecordValue;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'responsibilities')).toHaveLength(0);
	});

	test('accepts documented Python ownership boundaries', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.py': [
				'from typing import Protocol',
				'',
				'class Service:',
				'    """Responsibilities: _manage records, cache records_, _expose status_."""',
				'    def run(self):',
				'        """Responsibilities: _manage records_."""',
				'        return None',
				'',
				'def load():',
				'    """Responsibilities: _load records_."""',
				'    return ""',
				'',
				'class RecordsPort(Protocol):',
				'    """Responsibilities: _expose records_."""',
				'    def load(self):',
				'        ...',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'responsibilities')).toHaveLength(0);
	});

	test('ignores TypeScript and Python type aliases', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'aliases.ts': [
				'type RecordValue = string;',
				'type PrimitiveValue = string | number;',
				"type Status = 'ready';",
			].join('\n'),
			'aliases.py': [
				'from typing import TypeAlias',
				'',
				'RecordValue: TypeAlias = str',
				'"""Responsibilities: _represent records_."""',
				'PrimitiveValue: TypeAlias = str | int',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id.startsWith('responsibilities'))).toHaveLength(0);
	});

	test('requires paired underscores using the existing responsibility rule', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.ts': [
				'/** Responsibilities: load records, cache records. **/',
				'function load(): void {}',
			].join('\n'),
		});

		expect(violations).toEqual(expect.arrayContaining([
			expect.objectContaining({
				rule_id: 'responsibilities',
				message: 'violates the Responsibilities contract: use paired underscores around each responsibility',
			}),
		]));
	});

	test('requires the double-star comment closing', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.ts': [
				'/** Responsibilities: _load records_. */',
				'function load(): void {}',
			].join('\n'),
		});

		expect(violations).toEqual(expect.arrayContaining([
			expect.objectContaining({
				rule_id: 'responsibilities',
				message: 'violates the Responsibilities contract: use paired underscores around each responsibility',
			}),
		]));
	});

	test('enforces responsibility limits', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.ts': [
				'/** Responsibilities: _one_, _two_, _three_, _four_, _five_. **/',
				'class Service {',
				'  /** Responsibilities: _unrelated_. **/',
				'  run(): void {}',
				'}',
			].join('\n'),
			'service.py': [
				'class Service:',
				'    """Responsibilities: _one_, _two_."""',
				'    def run(self):',
				'        """Responsibilities: _one_, _two_, _three_."""',
				'        return None',
			].join('\n'),
		});

		const responsibility_violations = violations.filter(item => item.rule_id.startsWith('responsibilities'));
		expect(responsibility_violations).toHaveLength(2);
		expect(responsibility_violations.every(item => item.message === 'has too many responsibilities')).toBe(true);
	});

	test('requires documentation for functions', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'service.ts': 'function load(): void {}',
			'service.py': 'def load():\n    return None',
		});

		const responsibility_violations = violations.filter(item => item.rule_id === 'responsibilities');
		expect(responsibility_violations).toHaveLength(2);
		expect(responsibility_violations.every(item => item.message === 'violates the Responsibilities contract: missing a Responsibilities line')).toBe(true);
	});

	test('does not require documentation for interface methods', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'ports.ts': [
				'/** Responsibilities: _expose data_. **/',
				'interface Port {',
				'  read(): string;',
				'  write(value: string): void;',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'responsibilities')).toHaveLength(0);
	});

});
