import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { specialization_source } from 'tests/core/constants';

describe('coding-lint class metrics rules', () => {
  test('reports class and interface method specialization thresholds', () => {
    const test_fixture = new TestFixture();
    const violations = test_fixture.collect_fixture_violations({
      'specialization.ts': specialization_source,
    });
		const details = violations.map(item => [item.message, item.priority, item.rule_id]);
		expect(details).toEqual(expect.arrayContaining([
		['class has too few public methods (found 1)', 6, 'class-method-min-count'],
		['class has many public methods (found 6)', 1, 'class-method-count-info'],
		['class has too many public methods (found 16)', 3, 'class-method-max-count'],
		]));
		expect(details.filter(item => item[0] === 'class has many public methods (found 6)')).toHaveLength(2);
  });

  test('reports classes with callback fields declared directly on fields', () => {
    const test_fixture = new TestFixture();

    const messages = test_fixture.violation_messages({
      'callbacks.ts': [
        'class Callbacks {',
        '  on_one = () => 1;',
        '  on_two = () => 2;',
        '  on_three = () => 3;',
        '  on_four = () => 4;',
        '  run() {}',
        '  reset() {}',
        '}',
      ].join('\n'),
    });
		expect(messages).toContain('class has 4 callback fields with default implementations');
	});

  test('does not require a minimum public method count for interface implementations', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'implemented-interface.ts': [
        'interface Contract { run(): void; }',
        'class Adapter implements Contract {',
        '  run() {}',
        '}',
      ].join('\n'),
    });

    expect(violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'class has too few public methods (found 1)',
        }),
      ])
    );
  });

  test('ignores qualified TypeScript interface implementations for the minimum public count', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'qualified-interface.ts': [
        'class Adapter implements Contract {',
        '  run() {}',
        '} ',
      ].join('\n'),
    });

    expect(violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'class has too few public methods (found 1)',
        }),
      ])
    );
  });

  test('does not require a minimum public method count for class inheritance', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'inherited-class.ts': [
        'class Base {',
        '  run() {}',
        '}',
        'class Adapter extends Base {',
        '  run() {}',
        '}',
      ].join('\n'),
    });

    expect(
      violations.filter(item => item.message === 'class has too few public methods (found 1)')
    ).toHaveLength(1);
  });

  test('does not require a minimum public method count for Python protocol implementations', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'implemented-protocol.py': [
        'from typing import Protocol',
        '',
        'class Contract(Protocol):',
        '    def run(self) -> None: ...',
        '',
        'class Adapter(Contract):',
        '    def run(self) -> None:',
        '        return None',
      ].join('\n'),
    });

    expect(violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'class has too few public methods (found 1)',
        }),
      ])
    );
  });

  test('suggests a class for functions returning dictionary type aliases', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'dictionary-return.ts': [
        'type ProfileData = { name: string; serialize(): string; };',
        'function build_profile(): ProfileData { return { name: "Ada" }; }',
        'function build_text(): string { return "Ada"; }',
      ].join('\n'),
    });

    expect(violations).toContainEqual(
      expect.objectContaining({
        message: 'function returns a dictionary type alias',
        line: 2,
		priority: 5,
      })
    );
    expect(
      violations.filter(item => item.message === 'function returns a dictionary type alias')
    ).toHaveLength(1);
  });

	test('counts constructors as one class method position', () => {
    const test_fixture = new TestFixture();

    const violations = test_fixture.collect_fixture_violations({
      'constructor-count.ts': [
        'class Service {',
        '  constructor() {}',
        '  run() { return 1; }',
        '}',
      ].join('\n'),
    });

		expect(violations).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ message: 'class has too many methods (found 3)' })])
		);
	});

	test('reports procedural job-title names regardless of class state', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parser.ts': [
				'class JsonParser {',
				'  private readonly schema: JsonSchema;',
				'  public constructor(schema: JsonSchema) { this.schema = schema; }',
				'  public parse(text: string): string { return this.schema.parse(text); }',
				'}',
				'class JsonDocument {',
				'  private readonly text: string;',
				'  public constructor(text: string) { this.text = text; }',
				'  public value(): string { return this.text; }',
				'}',
			].join('\n'),
		});

		expect(violations).toContainEqual(expect.objectContaining({
			message: 'class name describes a job: "JsonParser"',
			priority: 2,
			rule_id: 'procedural-class-name',
		}));
		expect(violations).not.toContainEqual(expect.objectContaining({
			message: 'class name describes a job: "JsonDocument"',
		}));
	});

	test('reports the same procedural name hint for Python regardless of class state', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'parser.py': [
				'class JsonParser:',
				'    def __init__(self, schema):',
				'        self.schema = schema',
				'    def parse(self, text: str) -> str:',
				'        return self.schema.parse(text)',
				'',
				'class JsonDocument:',
				'    def __init__(self, text: str):',
				'        self.text = text',
				'    def value(self) -> str:',
				'        return self.text',
			].join('\n'),
		});

		expect(violations).toContainEqual(expect.objectContaining({
			message: 'class name describes a job: "JsonParser"',
			priority: 2,
			rule_id: 'procedural-class-name',
		}));
		expect(violations).not.toContainEqual(expect.objectContaining({
			message: 'class name describes a job: "JsonDocument"',
		}));
	});
});
