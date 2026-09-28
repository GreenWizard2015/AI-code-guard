import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { AstDiskCache } from 'src/bridge/ts/core/support/ast-disk-cache';
import { AstModel } from 'src/bridge/ts/core/ast-model';

describe('AstDiskCache', () => {
	const ast_model = new AstModel();

	test('uses a path-and-modification-time hash', () => {
		const root = mkdtempSync(join(tmpdir(), 'ai-code-guard-ast-cache-'));
		const source_file = join(root, 'module.py');
		writeFileSync(source_file, 'value = 1\n', 'utf8');
		const modified_at = statSync(source_file).mtimeMs;
		const absolute_file = resolve(source_file);
		const hash = createHash('sha256')
			.update(`${absolute_file}\u0000${String(modified_at)}`)
			.digest('hex');
		const cache = new AstDiskCache(root);
		cache.write(source_file, ast_model.empty_ast_file('python'));
		const files = readdirSync(join(root, '.ai-code-guard', 'cache'));
		rmSync(root, { recursive: true, force: true });

		expect(files).toEqual([`${hash}.json`]);
	});

	test('invalidates stale entries', () => {
		const root = mkdtempSync(join(tmpdir(), 'ai-code-guard-ast-cache-'));
		const source_file = join(root, 'module.py');
		writeFileSync(source_file, 'value = 1\n', 'utf8');
		const modified_at = statSync(source_file).mtimeMs;
		const cache = new AstDiskCache(root);
		cache.write(source_file, ast_model.empty_ast_file('python'));
		utimesSync(source_file, new Date(modified_at + 2000), new Date(modified_at + 2000));
		const entry = cache.content(source_file);
		rmSync(root, { recursive: true, force: true });

		expect(entry.present()).toBe(false);
	});

	test('stores normalized TypeScript AST values', () => {
		const root = mkdtempSync(join(tmpdir(), 'ai-code-guard-ts-ast-cache-'));
		const source_file = join(root, 'module.ts');
		writeFileSync(source_file, 'export const value = 1;\n', 'utf8');
		const ast = ast_model.empty_ast_file('typescript');
		const cache = new AstDiskCache(root);
		cache.write(source_file, ast);
		const entry = cache.content(source_file);
		rmSync(root, { recursive: true, force: true });

		expect(entry.value()).toEqual(ast);
	});
});
