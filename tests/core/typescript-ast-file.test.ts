import ts from 'typescript';

import { TypeScriptAstFile } from 'src/model/typescript-ast';
import { TypeScriptTypeNode } from 'src/model/typescript-type-node';

import { type_node_source, ast_source } from 'tests/core/constants';

describe('TypeScriptAstFile', () => {
	test('wraps TypeScript type-node predicates and details', () => {
		const declarations = ts.createSourceFile('types.ts', type_node_source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
			.statements.filter(ts.isTypeAliasDeclaration);
		const nodes = declarations.map(declaration => new TypeScriptTypeNode(declaration.type));
		const details = nodes.map(node => node.details());
		expect({
			parenthesized: details[0].parenthesized_type !== undefined,
			union: details[1].union,
			union_count: details[1].union_types.length,
			function: details[2].is_function,
			reference: details[3].reference_name,
			argument_count: details[3].reference_arguments.length,
		}).toEqual({ parenthesized: true, union: true, union_count: 2, function: true, reference: 'Array', argument_count: 1 });
	});

	test('extracts top-level classes and methods', () => {
		const parsed = new TypeScriptAstFile('fixture.ts', ast_source);
		expect({
			classes: parsed.classes().map(node => node.name),
			methods: parsed.classes()[0].methods.map(node => [node.name, node.argument_count]),
			sloc: parsed.classes()[0].sloc,
			lines: parsed.classes()[0].lines,
			argument_uses: parsed.classes()[0].methods[1].argument_uses,
		}).toEqual({
			classes: ['Service', 'Worker'],
			methods: [['constructor', 1], ['run', 2]],
			sloc: 4,
			lines: 4,
			argument_uses: expect.arrayContaining([expect.objectContaining({ name: 'first', count: 4 })]),
		});
	});

	test('extracts functions and metrics', () => {
		const parsed = new TypeScriptAstFile('fixture.ts', ast_source);
		expect(parsed.functions().map(node => [node.name, node.argument_count])).toEqual([
			['build', 2],
			['convert', 1],
		]);
	});

	test('reports callable metrics and normalized issues', () => {
		const parsed = new TypeScriptAstFile('fixture.ts', ast_source);
		expect({
			methods_have_characters: parsed.classes()
				.flatMap(node => node.methods)
				.every(node => node.characters !== undefined && node.characters > 0),
			functions_have_characters: parsed.functions().every(
				node => node.characters !== undefined && node.characters > 0
			),
			parse_issues: parsed.normalized().parse_issues,
		}).toEqual({ methods_have_characters: true, functions_have_characters: true, parse_issues: [] });
	});

	test('reuses the normalized TypeScript AST result', () => {
		const ast_file = new TypeScriptAstFile('item.ts', 'type Item = string;\n');

		const first_result = ast_file.normalized();
		const second_result = ast_file.normalized();

		expect(second_result).toBe(first_result);
	});

	test('distinguishes template, generic, named, and basic arguments', () => {
		const parsed = new TypeScriptAstFile(
			'typed-arguments.ts',
			[
				'class Result {}',
				'class Service<T> {',
				'  run(this: Service<T>, value: T, result: Promise<Result>, id: string) {',
				'    return [this, value, result, id];',
				'  }',
				'}',
			].join('\n')
		);

		expect(parsed.classes()[1].methods[0].typed_arguments).toEqual([
			{ name: 'this', type: 'Service<T>', kind: 'generic' },
			{ name: 'value', type: 'T', kind: 'template' },
			{ name: 'result', type: 'Promise<Result>', kind: 'generic' },
			{ name: 'id', type: 'string', kind: 'basic' },
		]);
	});

	test('collects named import aliases for reference normalization', () => {
		const parsed = new TypeScriptAstFile(
			'aliases.ts',
			[
				"import { RequestData as RequestAlias, OtherData } from './model';",
				'function read(value: RequestAlias) { return value; }',
			].join('\n')
		);

		expect(parsed.normalized().reference_aliases).toEqual([
			{ name: 'RequestAlias', target: 'RequestData' },
		]);
	});

	test('reports parser diagnostics separately from structural rules', () => {
		const parsed = new TypeScriptAstFile('broken.ts', 'export function broken( {');
		const issues = parsed.normalized().parse_issues;

		expect({
			count: issues.length,
			line: issues[0].line,
			has_message: issues[0].message.length > 0,
		}).toEqual({ count: expect.any(Number), line: 0, has_message: true });
	});

	test('counts callable body lines independently from SLOC', () => {
		const parsed = new TypeScriptAstFile(
			'flow.ts',
			[
				'export async function run_edit_flow(',
				'  editor: Editor,',
				'  input: Input',
				'): Promise<Result> {',
				'  // Formatting and comments do not add callable SLOC.',
				'  return execute({ editor, input });',
				'}',
			].join('\n')
		);

		expect(parsed.functions()[0]).toEqual(expect.objectContaining({ lines: 1, sloc: 2 }));
	});

	test('counts class body lines independently from its declaration', () => {
		const parsed = new TypeScriptAstFile(
			'class-lines.ts',
			[
				'export class Service',
				'  extends Base',
				'  implements Contract {',
				'  run(): void {',
				'    execute();',
				'  }',
				'}',
			].join('\n')
		);

		expect(parsed.classes()[0]).toEqual(expect.objectContaining({ lines: 3 }));
	});

	test('excludes member documentation from class body line metrics', () => {
		const parsed = new TypeScriptAstFile(
			'class-member-docs.ts',
			[
				'class Service {',
				'  /** Responsibilities: _run the service_. **/',
				'  run(): void {',
				'    execute();',
				'  }',
				'}',
			].join('\n')
		);

		expect(parsed.classes()[0]).toEqual(expect.objectContaining({ lines: 3 }));
	});

	test('counts nested control statements in callable SLOC', () => {
		const parsed = new TypeScriptAstFile(
			'nested.ts',
			[
				'function walk(items: string[]): void {',
				'  for (const item of items) {',
				'    if (item) return;',
				'  }',
				'}',
			].join('\n')
		);

		expect(parsed.functions()[0]).toEqual(expect.objectContaining({ sloc: 4 }));
	});

	test('keeps normalized reference collections stable across repeated reads', () => {
		const parsed = new TypeScriptAstFile(
			'references.ts',
			'function read(value: Root): void { value.child.leaf(); }'
		);

		const first = parsed.normalized();
		const second = parsed.normalized();

		expect(second.attribute_accesses).toEqual(first.attribute_accesses);
		expect(second.call_references).toEqual(first.call_references);
	});

	test('preserves owners through nested property and factory references', () => {
		const parsed = new TypeScriptAstFile(
			'owners.ts',
			[
				'class Leaf { run(): void {} }',
				'class Factory { create(): Leaf { return new Leaf(); } }',
				'const factory = new Factory();',
				'const holder = { leaf: new Leaf() };',
				'const leaf = holder.leaf;',
				'const created = factory.create();',
				'created.run();',
			].join('\n')
		);

		const calls = parsed.normalized().call_references;
		expect(calls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ owner: 'Leaf', name: 'run' }),
				expect.objectContaining({ owner: 'Factory', name: 'create' }),
			])
		);
	});

	test('counts a single call in each control-flow body as two SLOC', () => {
		const parsed = new TypeScriptAstFile(
			'control-flow.ts',
			[
				'function conditional(value: boolean): void { if (value) { execute(); } }',
				'function repeated(values: string[]): void { for (const value of values) { execute(value); } }',
				'function guarded(value: boolean): void { while (value) { execute(); } }',
				'function deferred(): void { do { execute(); } while (false); }',
				'function selected(value: string): void { switch (value) { case "a": execute(); break; } }',
				'function conditional_fallback(value: boolean): void { if (value) { execute(); } else { fallback(); } }',
				'function protected_call(): void { try { execute(); } finally { cleanup(); } }',
				'function recovered(): void { try { execute(); } catch (error) { recover(error); } }',
			].join('\n')
		);

		expect(parsed.functions().map(node => node.sloc)).toEqual([3, 3, 3, 3, 4, 4, 4, 4]);
	});
});
