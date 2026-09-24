import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { nullable_domain_files } from 'tests/core/constants';

describe('coding-lint Python-specific rules', () => {
	test('requires Python test functions to be class methods', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'tests/free_test.py': [
				'def test_free_function():',
				'    return True',
				'',
				'class TestMethods:',
				'    def test_method(self):',
				'        return True',
			].join('\n'),
		});

		expect(messages).toContain('python tests must be class methods');
		expect(
			messages.filter(message => message === 'python tests must be class methods')
		).toHaveLength(1);
	});

	test('requires Python test classes to inherit from unittest.TestCase', () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			'tests/pytest_test.py': [
				'import unittest',
				'import pytest',
				'',
				'class FixtureSupport:',
				'    @pytest.fixture',
				'    def test_resource(self):',
				'        return True',
				'',
				'class TestWithoutBase:',
				'    def test_result(self):',
				'        return True',
				'',
				'class TestUnit(unittest.TestCase):',
				'    def test_result(self):',
				'        return True',
				'',
				'class TestWithBase(pytest.ProjectTestBase):',
				'    def test_result(self):',
				'        return True',
			].join('\n'),
		});

		expect(violations.filter(item => item.rule_id === 'python-test-class-inheritance')).toHaveLength(2);
	});

	test('limits attribute chains to four levels in Python and TypeScript', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'chain.py': 'value = a.b.c.d.e\n',
			'chain.ts': 'const value = a.b.c.d.e;\n',
		});
		const violations = test_fixture.collect_fixture_violations({
			'chain.ts': 'const value = a.b.c.d.e;\n',
		});

		expect(
			messages.filter(message => message === 'attribute access is too deep (found 5 levels)')
		).toHaveLength(2);
		expect(
			violations.find(item => item.message === 'attribute access is too deep (found 5 levels)')?.hint
		).toContain('temporary local variables');
	});

	test('does not duplicate TypeScript attribute findings after repeated AST normalization', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'chain.ts': 'const value = a.b.c.d.e;\n',
		});

		expect(
			violations.filter(item => item.message === 'attribute access is too deep (found 5 levels)')
		).toHaveLength(1);
	});

	test('allows four-level attribute chains', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'chain.py': 'value = a.b.c.d\n',
			'chain.ts': 'const value = a.b.c.d;\n',
		});

		expect(messages).not.toContain('attribute access is too deep (found 5 levels)');
	});

	test('rejects large unions and recommends Optional for nullable annotations', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'unions.py': [
				'from typing import Optional',
				'Alias = int | str | float | bytes',
				'def load(value: str | None) -> Alias:',
				'    return value',
				'def nested(value: list[int | str | float | bytes]):',
				'    return value',
			].join('\n'),
			'unions.ts': ['type Alias = string | number | boolean | null;'].join('\n'),
		});

		expect(messages).toContain('avoid overly broad unions');
		expect(messages).toContain('use Optional[T] instead of T | None');
	});

	test('recommends specialized state classes for nullable domain types', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			...nullable_domain_files,
			'optional.ts': 'type Input = { readonly value?: string; };\nfunction load(input?: string): string { return ""; }',
		});

		expect(
			messages.filter(
				message => message === 'replace nullable types with specialized state classes'
			)
		).toHaveLength(11);
	});

	test('rejects Python fields typed only as nullish values', () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			'nullish-fields.py': [
				'class NullableFields:',
				'    missing: None',
				'    impossible: Never',
			].join('\n'),
		});

		expect(messages.filter(message => message === 'replace nullable types with specialized state classes')).toHaveLength(2);
	});

	test('reports shared named parameters when each method uses them once', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'dispatcher.py': [
				'class JsonValue: pass',
				'',
				'class Dispatcher:',
				'    def register(self, body: JsonValue):',
				'        return body',
				'    def unregister(self, body: JsonValue):',
				'        return body',
				'    def result(self, body: JsonValue):',
				'        return body',
				'    def dispatch(self, body: JsonValue):',
				'        return body',
			].join('\n'),
		});

		expect(
			messages.some(message =>
				message.startsWith('multiple methods share parameter type "JsonValue"')
			)
		).toBe(true);
	});

	test('rejects dynamic type factory construction', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'namedtuple.py': [
				'from collections import namedtuple',
				'request = namedtuple("Request", ["path"])',
				'response = collections.namedtuple("Response", ["body"])',
				'from typing import NamedTuple, TypedDict, NewType',
				'Response = NamedTuple("Response", [])',
				'Fields = TypedDict("Fields", {})',
				'UserId = NewType("UserId", int)',
				'class Record(TypedDict):',
				'    value: str',
			].join('\n'),
		});

		expect(
			messages.filter(
				message =>
					message === 'avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)'
			)
		).toHaveLength(6);
	});

	test('rejects direct class constructor calls', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'direct-init.py': [
				'class Child(Base):',
				'    def __init__(self):',
				'        Base.__init__(self)',
				'',
				'def reset(value):',
				'    Other.__init__(value)',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid direct calls to Class.__init__')
		).toHaveLength(2);
	});

	test('rejects callable objects through __call__', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'call-method.py': [
				'class Runner:',
				'    def __call__(self, value):',
				'        return value',
			].join('\n'),
		});

		expect(messages).toContain('avoid __call__ methods');
	});

	test('rejects direct object attribute mutation', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'object-setattr.py': [
				'def update(value):',
				'    object.__setattr__(value, "name", "updated")',
			].join('\n'),
		});

		expect(messages).toContain('avoid direct object.__setattr__ calls');
	});

	test('reports instance field writes outside constructors', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'mutable-fields.py': [
				'class Profile:',
				'    def __init__(self, name):',
				'        self.name = name',
				'',
				'    def rename(self, name):',
				'        self.name = name',
				'        self.version += 1',
				'',
				'    def __post_init__(self):',
				'        self.ready = True',
			].join('\n'),
		});

		expect(
			messages.filter(message => message === 'avoid assigning class fields outside constructors')
		).toHaveLength(2);
	});

	test('rejects Python property setters', () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			'property-setter.py': [
				'class Profile:',
				'    @property',
				'    def name(self):',
				'        return self._name',
				'',
				'    @name.setter',
				'    def name(self, value):',
				'        self._name = value',
			].join('\n'),
		});

		expect(messages).toContain('avoid Python property setters');
	});

});
