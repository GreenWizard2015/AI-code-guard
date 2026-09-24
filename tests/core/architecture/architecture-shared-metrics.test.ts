import { TestFixture } from 'tests/core/test-fixture';
import { describe, expect, test } from '@jest/globals';

import { shared_threshold_files, separate_class_files, method_candidates_files, project_wide_parameter_files, type_operation_files, external_type_files, generic_signature_files } from 'tests/core/constants';

describe('coding-lint architecture and metrics rules', () => {
	test('reports shared parameter types only after all thresholds', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(shared_threshold_files);

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining(
						'multiple methods share parameter type "RecordData" (4)'
					),
					priority: 5,
				}),
				expect.objectContaining({
					message: expect.stringContaining(
						'multiple functions share parameter type "RecordData" (4)'
					),
					priority: 5,
				}),
			])
		);
	});

	test('does not group methods across classes', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(separate_class_files);

		expect(
			violations.filter(item =>
				item.message.includes('multiple functions share parameter type "SharedInput"')
			)
		).toHaveLength(1);
		expect(violations.some(item => item.message.includes('multiple methods'))).toBe(false);
	});

	test('omits file names from method candidates', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(method_candidates_files);

		const diagnostic = violations.find(item => item.message.includes('multiple methods'));
		expect(diagnostic?.message).toContain('Service.first');
		expect(diagnostic?.message).not.toContain('first.ts:');
	});

	test('reports project-wide function parameter types and combinations once', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(project_wide_parameter_files);
		const existing_rule_violations = violations.filter(item => !item.rule_id.startsWith('responsibilities'));
		const request_message = existing_rule_violations.find(item => item.message.includes('RequestData'));
		expect({
			type_count: existing_rule_violations.filter(item => item.message.includes('multiple functions share parameter type "RequestData"')).length,
			combination_count: existing_rule_violations.filter(item => item.message.includes('multiple functions share parameter combination "CacheData, RequestData"')).length,
			hint: request_message?.hint,
			message: request_message?.message,
		}).toEqual(expect.objectContaining({
			type_count: 1,
			combination_count: 1,
			hint: expect.stringContaining('focused wrapper'),
			message: expect.stringContaining('first.ts:'),
		}));
		expect(request_message?.message).toContain('second.ts:');
	});

	test('reports type operations in production fixtures but not test fixtures', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(type_operation_files);
		const messages = violations.map(item => item.message);
		expect({
			pick: messages.includes('avoid type operation "Pick"'),
			indexed: messages.includes('avoid type operation "indexed access"'),
			intersection: messages.includes('avoid type operation "intersection type"'),
			test_file: violations.some(item => item.file.endsWith('tests/type-operations.ts') && item.message.startsWith('avoid type operation')),
			record: messages.includes('avoid type operation "Record"'),
		}).toEqual({ pick: true, indexed: true, intersection: true, test_file: false, record: false });
	});

	test('checks external types but ignores basic types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(external_type_files);

		expect({
			html: violations.some(item => item.message.includes('share parameter type "HTMLElement"')),
			json: violations.some(item => item.message.includes('share parameter type "JSON"')),
			promise: violations.some(item => item.message.includes('share parameter type "Promise<Result>"')),
			template: violations.some(item => item.message.includes('share parameter type "T"')),
			html_hint: violations.find(item => item.message.includes('share parameter type "HTMLElement"'))?.hint.includes('wrapper'),
			promise_hint: violations.find(item => item.message.includes('share parameter type "Promise<Result>"'))?.hint.includes('wrapper'),
		}).toEqual({ html: true, json: false, promise: true, template: false, html_hint: true, promise_hint: true });
	});

	test('reports generic parameter and return types', () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(generic_signature_files);

		expect({
			unknown: violations.filter(item => item.message.includes('uses unknown instead')).length,
			any: violations.filter(item => item.message.includes('uses Any instead')).length,
		ts_concrete: violations.some(item => item.message.includes('generic-signatures.ts') && item.message.includes('concrete')),
			python_concrete: violations.some(item => item.message.includes('generic-signatures.py') && item.message.includes('concrete')),
		}).toEqual({ unknown: 2, any: 2, ts_concrete: false, python_concrete: false });
	});

});
