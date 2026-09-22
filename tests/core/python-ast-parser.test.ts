import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import { PythonAstBridge } from 'src/bridge/ts/core/python-ast-bridge';
import { python_callable_source, control_flow_source } from 'tests/core/constants';

describe('parsePythonAst', () => {
	test('sends source code with the explicit bridge source prefix', () => {
		const bridge = new PythonAstBridge();
		const options = bridge.bridge_options('class Item:\n    pass\n');

		expect(options.input).toBe('code:class Item:\n    pass\n');
	});

	test('parses multiple source texts through one batch bridge request', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.batch_ast([
			'class First:\n    pass\n',
			'def second():\n    pass\n',
		]);

		expect(parsed.map(item => ({
			classes: item.classes.map(node => node.name),
			functions: item.functions.map(node => node.name),
		}))).toEqual([
			{ classes: ['First'], functions: [] },
			{ classes: [], functions: ['second'] },
		]);
	});

	test('extracts classes, methods, async functions, and argument counts', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(python_callable_source);

		expect({
			language: parsed.language,
			classes: parsed.classes.map(node => node.name),
			methods: parsed.classes[0].methods.map(node => [node.name, node.argument_count]),
			sloc: parsed.classes[0].sloc,
			lines: parsed.classes[0].lines,
			argument_uses: parsed.classes[0].methods[1].argument_uses,
		}).toEqual({
			language: 'python',
			classes: ['Service'],
			methods: [['__init__', 2], ['run', 3]],
			sloc: 5,
			lines: 5,
			argument_uses: expect.arrayContaining([expect.objectContaining({ name: 'first', count: 4 })]),
		});
	});

	test('extracts functions and callable metrics', () => {
		const python_ast_parser = new PythonAstData();
		const parsed = python_ast_parser.source_ast(python_callable_source);
		expect({
			functions: parsed.functions.map(node => [node.name, node.argument_count]),
			methods_have_characters: parsed.classes
				.flatMap(node => node.methods)
				.every(node => node.characters !== undefined && node.characters > 0),
			functions_have_characters: parsed.functions.every(
				node => node.characters !== undefined && node.characters > 0
			),
			parse_issues: parsed.parse_issues,
		}).toEqual({
			functions: [['build', 2], ['load', 2]],
			methods_have_characters: true,
			functions_have_characters: true,
			parse_issues: [],
		});
	});

	test('preserves generic argument annotations', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'class Result:',
				'    pass',
				'',
				'def collect(items: list[Result], fallback: Result, limit: int):',
				'    return items, fallback, limit',
			].join('\n')
		);

		expect(parsed.functions[0].typed_arguments).toEqual([
			{ name: 'items', type: 'list[Result]', kind: 'generic' },
			{ name: 'fallback', type: 'Result', kind: 'named' },
			{ name: 'limit', type: 'int', kind: 'basic' },
		]);
	});

	test('collects import aliases for reference normalization', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'from model import RequestData as RequestAlias',
				'import package as package_alias',
				'',
				'def read(value: RequestAlias):',
				'    return value',
			].join('\n')
		);

		expect(parsed.reference_aliases).toEqual([
			{ name: 'RequestAlias', target: 'RequestData' },
			{ name: 'package_alias', target: 'package' },
		]);
	});

	test('returns syntax errors as parse diagnostics', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast('def broken(:\n    pass\n');

		expect({
			classes: parsed.classes,
			functions: parsed.functions,
			issue_count: parsed.parse_issues.length,
			issue_line: parsed.parse_issues[0].line,
			has_message: parsed.parse_issues[0].message.length > 0,
		}).toEqual({ classes: [], functions: [], issue_count: 1, issue_line: 0, has_message: true });
	});

	test('recognizes documented annotation-only classes as type contracts', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			['class Payload:', '    """External payload shape."""', '    value: str'].join('\n')
		);

		expect(parsed.classes[0].type_contract).toBe(true);
	});

	test('counts callable body lines independently from SLOC', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'def run_edit_flow(',
				'    editor: Editor,',
				'    input: Input,',
				') -> Result:',
				'    # Comments do not add callable SLOC.',
				'    return execute(editor, input)',
			].join('\n')
		);

		expect(parsed.functions[0]).toEqual(expect.objectContaining({ lines: 1, sloc: 2 }));
	});

	test('ignores callable docstrings in size metrics and statements', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'def documented():',
				'    """',
				'    This documentation must not affect callable metrics.',
				'    """',
				'    return 1',
			].join('\n')
		);

		expect(parsed.functions[0]).toEqual(
			expect.objectContaining({
				lines: 1,
				sloc: 2,
				statements: [{ kind: 'return', line: 4 }],
			})
		);
	});

	test('counts class body lines independently from its declaration', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			['class Service(', '    Base,', '):', '    def run(self) -> None:', '        execute()'].join(
				'\n'
			)
		);

		expect(parsed.classes[0]).toEqual(expect.objectContaining({ lines: 2 }));
	});

	test('ignores class docstrings in class size metrics', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'class Service:',
				'    """',
				'    This documentation must not affect class metrics.',
				'    """',
				'    def run(self) -> None:',
				'        return None',
			].join('\n')
		);

		expect(parsed.classes[0]).toEqual(expect.objectContaining({ lines: 2, sloc: 3 }));
		expect(parsed.classes[0].methods[0]).toEqual(expect.objectContaining({ lines: 1, sloc: 2 }));
	});

	test('counts dataclass decorators and fields as four lines and four SLOC', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'@dataclass',
				'class PythonReferenceCollector:',
				'    tree: ast.Module',
				'    _state: PythonReferenceState = field(default_factory=PythonReferenceState)',
			].join('\n')
		);

		expect(parsed.classes[0]).toEqual(expect.objectContaining({ lines: 4, sloc: 4 }));
	});

	test('counts nested control statements in callable SLOC', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(
			[
				'def walk(items: list[str]) -> None:',
				'    for item in items:',
				'        if item:',
				'            return',
			].join('\n')
		);

		expect(parsed.functions[0]).toEqual(expect.objectContaining({ sloc: 4 }));
	});

	test('counts a single call in each control-flow body as two SLOC', () => {
		const python_ast_parser = new PythonAstData();

		const parsed = python_ast_parser.source_ast(control_flow_source);

		expect(parsed.functions.map(node => node.sloc)).toEqual([3, 3, 3, 3, 3, 4, 4]);
	});
});
