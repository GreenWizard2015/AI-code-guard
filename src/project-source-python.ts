import { relative } from 'node:path';
import { dirname } from 'node:path';
import { join } from 'node:path';
import type { AbsoluteImportCandidate } from 'src/types';

/** Responsibilities: _resolution Python absolute relative_. **/
export class ProjectSourcePython {
	private readonly import_suffixes = [
		'',
		'.ts',
		'.tsx',
		'.py',
		'/index.ts',
		'/index.tsx',
		'/__init__.py',
	] as const;
	private readonly absolute_import_cache = new WeakMap<Set<string>, Map<string, Map<string, AbsoluteImportCandidate>>>();
	private readonly import_part_cache = new WeakMap<Set<string>, Map<string, Set<string>>>();

	/** Responsibilities: _aggregation candidates absolute import_. **/
	private append_absolute_imports(
		index: Map<string, AbsoluteImportCandidate>,
		root: string,
		file: string,
		order: number
	): void {
		const parts = relative(root, file).replaceAll('\\', '/').split('/');
		for (let start = 0; start < parts.length; start += 1) {
			const suffix = parts.slice(start).join('/');
			if (!index.has(suffix)) {
				index.set(suffix, { file, order });
			}
		}
	}

	/** Responsibilities: _caching absolute-import indexing package_. **/
	private cached_roots(files: Set<string>): Map<string, Map<string, AbsoluteImportCandidate>> {
		let roots = this.absolute_import_cache.get(files);
		if (roots === undefined) {
			roots = new Map();
			this.absolute_import_cache.set(files, roots);
		}
		return roots;
	}

	/** Responsibilities: _indexing Python modules packages_. **/
	private absolute_import_index(root: string, files: Set<string>): Map<string, AbsoluteImportCandidate> {
		const roots = this.cached_roots(files);
		const cached = roots.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, AbsoluteImportCandidate>();
		let order = 0;
		for (const file of files) {
			this.append_absolute_imports(index, root, file, order);
			order += 1;
		}
		roots.set(root, index);
		return index;
	}

	/** Responsibilities: _resolution absolute Python import_. **/
	private resolve_absolute_import(
		root: string,
		specifier: string,
		files: Set<string>
	): string {
		const module_file = `${specifier.split('.').join('/')}.py`;
		const package_file = `${specifier.split('.').join('/')}/__init__.py`;
		const index = this.absolute_import_index(root, files);
		const module_candidate = index.get(module_file);
		const package_candidate = index.get(package_file);
		if (module_candidate === undefined) {
			if (package_candidate === undefined) {
				return '';
			}
			return package_candidate.file;
		}
if (package_candidate === undefined || module_candidate.order < package_candidate.order) {
			return module_candidate.file;
		}
		return package_candidate.file;
	}

	/** Responsibilities: _resolution relative Python import_. **/
	private resolve_relative_import(
		importer: string,
		specifier: string,
		files: Set<string>
	): string {
		let level = 0;
		while (specifier[level] === '.') {
			level += 1;
		}
		let base = dirname(importer);
		for (let index = 1; index < level; index += 1) {
			base = dirname(base);
		}
		const module = specifier.slice(level);
		let module_path = base;
		if (module) {
			module_path = join(base, ...module.split('.'));
		}
		return this.select_import_candidate(module_path, files);
	}

	/** Responsibilities: _aggregation importable module parts_. **/
	private append_import_parts(root: string, file: string, parts: Set<string>): void {
		for (const part of relative(root, file).split('/')) {
			parts.add(part);
		}
	}

	/** Responsibilities: _collection importable module parts_. **/
	private import_parts(root: string, files: Set<string>): Set<string> {
		let roots = this.import_part_cache.get(files);
		if (roots === undefined) {
			roots = new Map();
			this.import_part_cache.set(files, roots);
		}
		const cached = roots.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const parts = new Set<string>();
		for (const file of files) {
			this.append_import_parts(root, file, parts);
		}
		roots.set(root, parts);
		return parts;
	}

	/** Responsibilities: _selection best source candidate_. **/
	public select_import_candidate(base: string, files: Set<string>): string {
		for (const suffix of this.import_suffixes) {
			const candidate = `${base}${suffix}`;
			if (files.has(candidate)) {
				return candidate;
			}
		}
		return '';
	}

	/** Responsibilities: _resolution Python import path_. **/
	public python_import_path(
		root: string,
		importer: string,
		specifier: string,
		files: Set<string>
	): string {
		if (!specifier.startsWith('.')) {
			return this.resolve_absolute_import(root, specifier, files);
		}
		return this.resolve_relative_import(importer, specifier, files);
	}

	/** Responsibilities: _reporting Python import resolution_. **/
	public python_import(root: string, specifier: string, files: Set<string>): boolean {
		const first_part = specifier.split('.')[0];
		return this.import_parts(root, files).has(first_part);
	}
}
