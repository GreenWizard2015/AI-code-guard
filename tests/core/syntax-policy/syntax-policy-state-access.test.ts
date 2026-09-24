import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';
import { typeof_cases } from 'tests/core/constants';

describe('coding-lint syntax policy - state and access', () => {
	const test_fixture = new TestFixture();
	test('allows explicit if statements in constructors', () => {
		const messages = test_fixture.violation_messages({
			'constructor-if.ts': [
				'class Consumer {',
				'  private readonly value: string;',
				'  constructor(value: string) {',
				'    if (!value) {',
				'      throw new Error("value required");',
				'    }',
				'    this.value = value;',
				'  }',
				'}',
			].join('\n'),
		});

		expect(messages).not.toContain('keep constructors limited to setup and validation');
	});

	test('rejects bind callback construction', () => {
		const messages = test_fixture.violation_messages({
			'bound-callback.ts': 'const callback = service.run.bind(service);',
		});

		expect(messages).toContain('avoid .bind calls');
	});

	test('rejects private member access from outside its class', () => {

		const messages = test_fixture.violation_messages({
			'private.ts': [
				'class Sample {',
				'  private secret() {}',
				'  inside() { this.secret(); }',
				'}',
				'const sample = new Sample();',
				'sample.secret();',
			].join('\n'),
		});

		expect(messages).toContain(
			'private class members must not be accessed from outside their class'
		);
	});

	test('does not treat local prototype references as prototype construction', () => {

		const messages = test_fixture.violation_messages({
			'dom-prototype-reference.ts': [
				'function set_value(element: HTMLInputElement, value: string): void {',
				'  let prototype: typeof HTMLInputElement.prototype = HTMLInputElement.prototype;',
				'  prototype = HTMLInputElement.prototype;',
				'  Object.getOwnPropertyDescriptor(prototype, "value");',
				'}',
			].join('\n'),
		});

		expect(messages).not.toContain('avoid prototype-based class construction');
	});

	test('does not treat returned closures as pointless assignments', () => {

		const messages = test_fixture.violation_messages({
			'returned-closure.ts': [
				'function create_loader(): Loader {',
				'  const state = create_state();',
				'  const load = async (): Promise<string> => state.read();',
				'  return { load };',
				'}',
			].join('\n'),
		});

		expect(messages).not.toContain('avoid pointless temporary assignments');
	});

	test('reports repeated typeof checks but allows a single boundary check', () => {

		const single_messages = test_fixture.violation_messages({ 'single-typeof.ts': typeof_cases.single });
		const repeated_messages = test_fixture.violation_messages({ 'repeated-typeof.ts': typeof_cases.repeated });
		expect(single_messages).not.toContain('avoid repeated typeof checks in business logic');
		expect(
			repeated_messages.filter(
				message => message === 'avoid repeated typeof checks in business logic'
			)
		).toHaveLength(2);
	});

	test('rejects callable feature-detection fallbacks in TypeScript and Python', () => {
		const typescript_messages = test_fixture.violation_messages({
			'callable-fallback.ts': [
				'function execute(service: Service): void {',
				'  if (typeof service.run !== "function") {',
				'    fallback();',
				'  }',
				'  if (typeof service.stop === "function") {',
				'    service.stop();',
				'  }',
				'}',
			].join('\n'),
		});
		const python_messages = test_fixture.violation_messages({
			'callable-fallback.py': [
				'def execute(service: Service) -> None:',
				'    if not callable(service.run):',
				'        fallback()',
				'    if callable(service.stop):',
				'        service.stop()',
			].join('\n'),
		});

		const message = 'avoid callable feature detection for project-owned interfaces';
		expect(typescript_messages.filter(item => item === message)).toHaveLength(2);
		expect(python_messages.filter(item => item === message)).toHaveLength(2);
	});

	test('allows callable values outside feature-detection if statements', () => {
		const typescript_messages = test_fixture.violation_messages({
			'callable-value.ts': 'function accept(handler: Handler): boolean { return typeof handler === "function"; }',
		});
		const python_messages = test_fixture.violation_messages({
			'callable-value.py': 'def accept(handler: Handler) -> bool:\n    return callable(handler)',
		});

		expect(typescript_messages).not.toContain('avoid callable feature detection for project-owned interfaces');
		expect(python_messages).not.toContain('avoid callable feature detection for project-owned interfaces');
	});

	test('rejects Python private member access from outside a class', () => {

		const messages = test_fixture.violation_messages({
			'private.py': [
				'class Sample:',
				'    def __init__(self):',
				'        self._secret = 1',
				'    def read(self):',
				'        return self._secret',
				'    def read_other(self, other):',
				'        return other._secret',
				'sample = Sample()',
				'sample._secret',
				'sample.__class__',
			].join('\n'),
		});

		expect(messages).toContain(
			'private class members must not be accessed from outside their class'
		);
		expect(
			messages.filter(
				message => message === 'private class members must not be accessed from outside their class'
			)
		).toHaveLength(2);
	});

	test('rejects Python private member access through reflection and dictionaries', () => {

		const messages = test_fixture.violation_messages({
			'private-bypasses.py': [
				'class Sample:',
				'    def __init__(self):',
				'        self._secret = 1',
				'sample = Sample()',
				'getattr(sample, "_secret")',
				'setattr(sample, "_secret", 2)',
				'sample.__getattribute__("_secret")',
				'sample.__setattr__("_secret", 3)',
				'sample.__dict__["_secret"]',
			].join('\n'),
		});

		expect(
			messages.filter(
				message => message === 'private class members must not be accessed from outside their class'
			)
		).toHaveLength(5);
	});
});
