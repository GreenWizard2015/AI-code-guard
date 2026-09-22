import { MixCollection } from 'src/bridge/ts/core/mix-collection';
import { TestFixture } from 'tests/core/test-fixture';
import type { Violation } from 'src/protocols';
import { LintFileName } from 'src/bridge/ts/core/context/file-name';


describe('normalized AST class metrics and ownership', () => {
	test('does not exempt project files from class and function ownership checks', () => {
		const test_fixture = new TestFixture();
		const source = 'class Service:\n    pass\n\ndef build():\n    return 1';
		const lengths = [
			'tools/webmcp/core/proxy_handler.py',
			'tools/webmcp/core/proxy_config.py',
			'tools/webmcp/tool/context.py',
		].map(file => {
			const violations = test_fixture.collect_fixture_violations({ [file]: source });
			return violations.filter(item => item.rule_id === 'mixed-module').length;
		});
		expect(lengths).toEqual([1, 1, 1]);
	});

	test('allows exception classes to share a file with parsing functions', () => {
		const mix_collection = new MixCollection();

		const lengths = ['errors.ts', 'errors.py'].map(file => {
			const violations: Violation[] = [];
			mix_collection.append_mix_violations(
				violations,
				[
					{
						name: file.endsWith('.py') ? 'AgentValidationException' : 'AgentValidationError',
						start: 8,
						end: 20,
						base_class_name: file.endsWith('.py') ? 'ValueError' : 'Error',
						base_class_names: [],
						type_contract: false,
						protocol: false,
						methods: [],
					},
				],
				[{ name: 'parse_response', start: 2, end: 6, argument_count: 1 }],
				new LintFileName(file)
			);
			return violations.length;
		});
		expect(lengths).toEqual([0, 0]);
	});

	test('checks short local classes regardless of their names', () => {
		const test_fixture = new TestFixture();

		const results = ['RequestHandler', 'ProxyServer', 'PayloadError'].map(name => {
			const violations: Violation[] = [];
			test_fixture.append_class_violations(violations, `${name}.ts`, {
				name,
				start: 0,
				end: 1,
				methods: [],
				fields: [],
			});
			return violations.some(item => item.message.includes('class is too short'));
		});
		expect(results).toEqual([true, true, true]);
	});

	test('skips methods when the class extends an external framework base', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'tools/webmcp/core/proxy_handler.py', {
			name: 'WebMcpProxyHandler',
			start: 0,
			end: 40,
			extends_external_class: true,
			methods: [{ name: 'do_GET', start: 10, end: 12, argument_count: 1 }],
			fields: [],
		});

		expect(violations.some(item => item.message.includes('method is too short'))).toBe(false);
	});

	test('skips method length metrics for classes extending external bases', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		const source = [
			'class ExternalHandler extends HttpHandler {',
			'  veryLongExternalHandlerMethodName() { return 1; }',
			'}',
		].join('\n');
		const parsed_violations = test_fixture.collect_fixture_violations({ 'external-handler.ts': source });
		violations.push(...parsed_violations);

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: expect.stringContaining('method has'),
				}),
			])
		);
	});

	test('reports stateless classes and forbids local class inheritance', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'local.ts', {
			name: 'Child',
			start: 4,
			end: 20,
			base_class_name: 'Base',
			methods: [{ name: 'run', start: 5, end: 8, argument_count: 0 }],
			fields: [],
		});

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'class is stateless',
					priority: 6,
				}),
				expect.objectContaining({
					message: 'class inherits from local class "Base"',
					priority: 6,
				}),
			])
		);
	});

	test('allows stateful classes and external inheritance', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'external.ts', {
			name: 'Handler',
			start: 0,
			end: 40,
			extends_external_class: true,
			fields: [{ line: 2, name: 'client', value_name: 'Client' }],
			methods: [{ name: 'constructor', start: 1, end: 4, argument_count: 1 }],
		});

		expect(violations.some(item => item.message === 'class is stateless')).toBe(false);
		expect(violations.some(item => item.message.includes('inherits from local class'))).toBe(false);
	});

	test('reports mixins without applying unrelated class design rules', () => {
		const test_fixture = new TestFixture();

		const violations: Violation[] = [];
		test_fixture.append_class_violations(violations, 'mixin.py', {
			name: 'LoggingMixin',
			start: 0,
			end: 20,
			base_class_name: 'BaseMixin',
			methods: [{ name: 'log', start: 1, end: 4, argument_count: 1 }],
			fields: [],
		});

		expect({
			stateless: violations.some(item => item.message === 'class is stateless'),
			inheritance: violations.some(item => item.message.includes('inherits from local class')),
			mixin: violations.some(item =>
				item.message === 'class uses mixin pattern "LoggingMixin"' && item.priority === 6
			),
		}).toEqual({ stateless: false, inheritance: false, mixin: true });
	});
});
