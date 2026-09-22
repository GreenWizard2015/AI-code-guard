import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { external_name_files, python_alias_files, typescript_declaration_files, ignored_external_names, reported_project_names } from 'tests/core/constants';

describe('coding-lint naming rules', () => {
	test('rejects leading underscores on module functions and public methods', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'function _module_helper() { return 1; }',
				'class Service {',
				'  _public_helper() { return 1; }',
				'  private _private_helper() { return 1; }',
				'}',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'module function "_module_helper" must not use a leading underscore',
				'public method "_public_helper" must not use a leading underscore',
			])
		);
		expect(violations.map(violation => violation.message)).not.toContain(
			'public method "_private_helper" must not use a leading underscore'
		);
	});

	test('requires snake_case names with no more than three words', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'const VALID_NAME = 1;',
				'const module_name = 1;',
				'const storeFailedTaskResult = () => VALID_NAME;',
				'function four_word_function_name() { return VALID_NAME; }',
				'function valid_function() { return VALID_NAME; }',
				'class Sample {',
				'  method_with_local_constant() { const local_name = 1; return local_name; }',
				'  storeFailedTaskResult = 1;',
				'  storeFailedTaskResult() { return VALID_NAME; }',
				'}',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'constant "storeFailedTaskResult" must use snake_case and has too many words (found 4)',
				'constant "module_name" must use snake_case and has too many words (found 2)',
				'function "four_word_function_name" must use snake_case and has too many words (found 4)',
				'field "storeFailedTaskResult" must use snake_case and has too many words (found 4)',
				'method "storeFailedTaskResult" must use snake_case and has too many words (found 4)',
			])
		);
	});

	test('checks field names declared in TypeScript type literals', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'type InputShape = {',
				'  fileName: string;',
				'  projectClassNames?: ReadonlySet<string>;',
				'};',
			].join('\n'),
		});

		expect(violations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'field "fileName" must use snake_case and has too many words (found 2)',
				'field "projectClassNames" must use snake_case and has too many words (found 3)',
			])
		);
		expect(new Set(violations.filter(violation => violation.rule_id === 'naming').map(violation => violation.priority))).toEqual(
			new Set([2])
		);
	});

	test('checks fields and optional properties in source records', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': 'export type PythonLintInput = {\n  file_name: FileNameLike;\n  text: string;\n  project_class_names?: ReadonlySet<string>;\n  project_protocol_names?: ReadonlySet<string>;\n  project_type_names?: ReadonlySet<string>;\n  normalized_ast?: NormalizedAstFile;\n};\nexport type LintSourceRecord = {\n  absolutePath: string;\n  relativePath: string;\n  fileName: LintFileName;\n  text: string;\n  language: AstLanguage;\n  typescriptAst?: TypeScriptAstFile;\n  normalizedAst: NormalizedAstFile;\n};',
		});

		expect(violations.map(violation => violation.message)).toEqual(
			expect.arrayContaining([
				'field "absolutePath" must use snake_case and has too many words (found 2)',
				'field "relativePath" must use snake_case and has too many words (found 2)',
				'field "fileName" must use snake_case and has too many words (found 2)',
				'field "typescriptAst" must use snake_case and has too many words (found 2)',
				'field "normalizedAst" must use snake_case and has too many words (found 2)',
			])
		);
		expect(
			violations.filter(
				violation => violation.message === 'replace nullable types with specialized state classes'
			)
		).toHaveLength(5);
	});

	test('does not apply the name limit to tests', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'tests/source.test.ts': 'function storeFailedTaskResultWithExtraWords() { return 1; }\n',
		});

		const naming_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		expect(naming_violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('storeFailedTaskResultWithExtraWords'),
				}),
			])
		);
	});

	test('ignores external runtime symbols but not project or mock names', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(external_name_files);
		const messages = violations.map(violation => violation.message);

		expect({
			ignored: ignored_external_names.map(name => messages.some(message => message.includes(`"${name}"`))),
			reported: reported_project_names.map(name => messages.some(message => message.includes(`"${name}"`))),
		}).toEqual({
			ignored: [false, false, false],
			reported: [true, true, true, true, true, true],
		});
	});

	test('checks declared method names', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'class InternalClient {',
				'  sendAndReceive() { return 1; }',
				'}',
			].join('\n'),
		});

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('method "sendAndReceive"'),
				}),
			])
		);
	});

	test('ignores external method calls', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'declare const facebook_module: { sendAndReceive: (value: unknown) => unknown };',
				'facebook_module.sendAndReceive({ externalId: "message" });',
			].join('\n'),
		});

		const naming_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		expect(naming_violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('externalId'),
				}),
			])
		);
	});

	test('checks method names declared in interfaces', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'source.ts': [
				'interface NavigationPort {',
				'  get_stale_input(): HTMLElement | null;',
				'  getStaleComposerInput(): HTMLElement | null;',
				'}',
			].join('\n'),
		});

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'method "getStaleComposerInput" must use snake_case and has too many words (found 4)',
				}),
			])
		);
	});

	test('skips method names inherited from external classes', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'external-handler.ts': [
				'class ExternalHandler extends HttpHandler {',
				'  veryLongExternalHandlerMethodName() { return 1; }',
				'}',
			].join('\n'),
		});

		const naming_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		expect(naming_violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('veryLongExternalHandlerMethodName'),
				}),
			])
		);
	});

	test('keeps method naming checks for project-owned base classes', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			'project-handler.ts': [
				'class ProjectHandler {}',
				'class DerivedHandler extends ProjectHandler {',
				'  veryLongProjectMethodName() { return 1; }',
				'}',
			].join('\n'),
		});

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('veryLongProjectMethodName'),
				}),
			])
		);
	});

	test('requires PascalCase names for Python TypeAlias declarations', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(python_alias_files);

		const naming_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'type alias "valid_alias" must use PascalCase without underscores',
				}),
				expect.objectContaining({
					message: 'type alias "_PrivateAlias" must use PascalCase without underscores',
				}),
			])
		);
		expect(naming_violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('ValidAlias'),
				}),
			])
		);
	});

	test('requires PascalCase names without underscores for TypeScript declarations', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(typescript_declaration_files);

		const naming_violations = violations.filter(violation => !violation.rule_id.startsWith('responsibilities'));
		expect(naming_violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ message: 'type "invalid_type" must use PascalCase without underscores', priority: 2 }),
				expect.objectContaining({ message: 'type "_InvalidInterface" must use PascalCase without underscores', priority: 2 }),
				expect.objectContaining({ message: 'type "invalid_enum" must use PascalCase without underscores', priority: 2 }),
				expect.objectContaining({ message: 'type "_InvalidClass" must use PascalCase without underscores', priority: 2 }),
			])
		);
		expect(naming_violations.map(violation => violation.message)).not.toEqual(
			expect.arrayContaining([
				expect.stringContaining('ValidType'),
				expect.stringContaining('ValidInterface'),
				expect.stringContaining('ValidEnum'),
				expect.stringContaining('ValidClass'),
			])
		);
	});
});
