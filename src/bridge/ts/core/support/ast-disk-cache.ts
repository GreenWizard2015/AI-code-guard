import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { NormalizedAstFile } from 'src/types';
import { AstCacheHit } from 'src/bridge/ts/core/support/ast-cache-hit';
import { AstCacheMiss } from 'src/bridge/ts/core/support/ast-cache-miss';
import type { AstCacheEntry } from 'src/bridge/ts/core/support/protocols';

/** Responsibilities: _AST cache storage_, _source freshness_. **/
export class AstDiskCache {
	private readonly cache_directory: string;

	/** Responsibilities: _cache filename hash construction_. **/
	private file_path(source_file: string): string {
		const absolute_file = resolve(source_file);
		const modified_at = statSync(absolute_file).mtimeMs;
		const key = createHash('sha256')
			.update(`${absolute_file}\u0000${String(modified_at)}`)
		.digest('hex');
		return join(this.cache_directory, `${key}.json`);
	}

	/** Responsibilities: _AST cache initialization_. **/
	public constructor(repo_root: string) {
		this.cache_directory = join(resolve(repo_root), '.ai-code-guard', 'cache');
	}

	/** Responsibilities: _persistent AST content resolution_. **/
	public content(source_file: string): AstCacheEntry {
		try {
			const ast: NormalizedAstFile = JSON.parse(readFileSync(this.file_path(source_file), 'utf8'));
			const cached = new AstCacheHit(ast);
			if (!cached.complete()) {
				return new AstCacheMiss(source_file, 'invalid normalized AST');
			}
			return cached;
		} catch (error) {
			if (typeof error !== 'object') {
				throw error;
			}
			return new AstCacheMiss(source_file, 'cache file unavailable');
		}
	}

	/** Responsibilities: _persistent AST storage_. **/
	public write(source_file: string, ast: NormalizedAstFile): void {
		try {
			const path = this.file_path(source_file);
			mkdirSync(this.cache_directory, { recursive: true });
			const temporary_path = `${path}.${process.pid}.${randomUUID()}.tmp`;
			writeFileSync(temporary_path, JSON.stringify(ast), 'utf8');
			renameSync(temporary_path, path);
		} catch (error) {
			if (typeof error !== 'object') {
				throw error;
			}
			return;
		}
	}
}
