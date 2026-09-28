import { dirname, join, normalize } from 'node:path';
import { PYTHON_EXTERNAL_MODULES } from 'src/bridge/ts/runner/orchestration/runtime/test-targets/constants';
import type { TestFileOrganizationProtocol } from 'src/protocols';

/** Responsibilities: _matching test target roots_. **/
export class TestTargetRoots {
	private readonly test_file_organization: TestFileOrganizationProtocol;

	/** Responsibilities: _TypeScript import path_. **/
	private typescript_import_path(file: string, specifier: string): string {
		if (specifier.startsWith('src/')) {
			return specifier;
		}
		if (!specifier.startsWith('.')) {
			return '';
		}
		return normalize(join(dirname(file), specifier));
	}

	/** Responsibilities: _Python relative import path_. **/
	private python_relative_path(file: string, specifier: string): string {
		let dots = 0;
		for (const character of specifier) {
			if (character !== '.') {
				break;
			}
			dots += 1;
		}
		const module_name = specifier.slice(dots).replaceAll('.', '/');
		let directory = dirname(file);
		for (let index = 1; index < dots; index += 1) {
			directory = dirname(directory);
		}
		return normalize(join(directory, module_name));
	}

	/** Responsibilities: _Python import path_. **/
	private python_import_path(file: string, specifier: string): string {
		if (specifier.startsWith('.')) {
			return this.python_relative_path(file, specifier);
		}
		const root = specifier.split('.')[0];
		if (root === undefined || PYTHON_EXTERNAL_MODULES.has(root)) {
			return '';
		}
		if (this.test_file_organization.source_directory(['tools', root])) {
			return join('tools', root);
		}
		return join('src', 'parser', 'python-bridge', specifier.replaceAll('.', '/'));
	}

	/** Responsibilities: _import source path_. **/
	private source_path(file: string, specifier: string, python: boolean): string {
		if (python) {
			return this.python_import_path(file, specifier);
		}
		return this.typescript_import_path(file, specifier);
	}

	/** Responsibilities: _source module root_. **/
	private source_module_root(file: string): string[] {
		const source_segments = this.source_segments(file);
		const last_segment = source_segments[source_segments.length - 1];
		if (last_segment === undefined) {
			return [];
		}
		const module_name = last_segment.replace(/\.(?:[cm]?[jt]sx?|py)$/, '');
		source_segments[source_segments.length - 1] = module_name;
		source_segments.pop();
		if (source_segments.length === 0) {
			return [module_name];
		}
		return source_segments;
	}

	/** Responsibilities: _source path segments_. **/
	private source_segments(file: string): string[] {
		const segments = file.replaceAll('\\', '/').split('/').filter(Boolean);
		const source_index = segments.indexOf('src');
		if (source_index >= 0) {
			return segments.slice(source_index + 1);
		}
		const tools_index = segments.indexOf('tools');
		if (tools_index >= 0) {
			return segments.slice(tools_index);
		}
		return [];
	}

	/** Responsibilities: _matching source root prefix_. **/
	private matches_module_path(root: string[], module_path: string[]): boolean {
		if (root.length > module_path.length) {
			return false;
		}
		for (let index = 0; index < root.length; index += 1) {
			if (root[index] !== module_path[index]) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _common prefix length_. **/
	private common_length(shared: string[], path: string[]): number {
		let length = Math.min(shared.length, path.length);
		while (length > 0 && shared.slice(0, length).join('/') !== path.slice(0, length).join('/')) {
			length -= 1;
		}
		return length;
	}

	/** Responsibilities: _shared target prefix_. **/
	private shared_prefix(paths: string[][]): string[] {
		const shared: string[] = [];
		for (const path of paths) {
			if (shared.length === 0) {
				shared.push(...path);
				continue;
			}
			shared.splice(this.common_length(shared, path));
		}
		return shared;
	}

	/** Responsibilities: _initialization target root checker_. **/
	public constructor(test_file_organization: TestFileOrganizationProtocol) {
		this.test_file_organization = test_file_organization;
	}

	/** Responsibilities: _target common root_. **/
	public common_root(file: string, imports: string[], python: boolean, module_path: string[]): string[] {
		const paths = imports
			.map((specifier) => this.source_path(file, specifier, python))
			.map((path) => this.source_module_root(path))
			.filter((path) => this.matches_module_path(path, module_path))
			.filter((path) => path.length > 0);
		return this.shared_prefix(paths);
	}

	/** Responsibilities: _test root matching_. **/
	public matches(file: string, imports: string[], python: boolean): boolean {
		for (const module_path of this.test_file_organization.module_paths(file)) {
			const common = this.common_root(file, imports, python, module_path);
			if (common.length === 0) {
				continue;
			}
			let matches = true;
			for (let index = 0; index < common.length; index += 1) {
				if (module_path[index] !== common[index]) {
					matches = false;
					break;
				}
			}
			if (matches) {
				return true;
			}
		}
		return false;
	}
}
