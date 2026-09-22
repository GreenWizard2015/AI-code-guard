import { describe, expect, test } from '@jest/globals';
import { TestFixture } from 'tests/core/test-fixture';

describe('proxy lambda rules', () => {
	test('rejects proxy lambdas in both languages', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'proxy-lambda.ts': [
				'type Expression = string;',
				'interface OwnerResolver { dispatch(expression: Expression, owner: string): string; }',
				'class Context implements OwnerResolver {',
				'\tpublic dispatch(expression: Expression, owner: string): string { return owner + expression; }',
				'\tpublic bad(): OwnerResolver {',
				'\t\treturn { dispatch: (expression, owner) => this.dispatch(owner, expression) };',
				'\t}',
				'\tpublic good(): OwnerResolver { return this; }',
				'}',
				'declare const external: OwnerResolver;',
				'const external_proxy = (expression: Expression, owner: string): string => external.dispatch(expression, owner);',
			].join('\n'),
			'proxy-lambda.py': [
				'class Context:',
				'    def dispatch(self, expression: str, owner: str) -> str:',
				'        return owner + expression',
				'    def bad(self):',
				'        return lambda expression, owner: self.dispatch(owner, expression)',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'proxy-lambda')).toHaveLength(2);
	});

	test('does not report event listener callbacks as proxy lambdas', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'event-listener.ts': [
				'class Context {',
				'\tpublic call_owner(expression: string, owner: string): string { return owner + expression; }',
				'\tpublic attach(element: HTMLElement): void {',
				'\t\telement.addEventListener(\'event\', (expression, owner) => this.call_owner(expression, owner));',
				'\t}',
				'}',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'proxy-lambda')).toHaveLength(0);
	});

	test('limits implemented interfaces and protocols per class', () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			'interfaces.ts': [
				'interface FirstPort {}',
				'interface SecondPort {}',
				'interface ThirdPort {}',
				'interface FourthPort {}',
				'class Adapter implements FirstPort, SecondPort, ThirdPort, FourthPort {}',
			].join('\n'),
			'protocols.py': [
				'from typing import Protocol',
				'class FirstPort(Protocol): ...',
				'class SecondPort(Protocol): ...',
				'class ThirdPort(Protocol): ...',
				'class FourthPort(Protocol): ...',
				'class Adapter(FirstPort, SecondPort, ThirdPort, FourthPort):',
				'    pass',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'class-interface-count')).toHaveLength(2);
	});
});
