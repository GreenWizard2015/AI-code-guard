import { existsSync } from 'node:fs';
import { relative, extname } from 'node:path';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { basename } from 'node:path';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { RuleParameters } from 'src/types';
import { PLACEMENT_DIAGNOSTIC_GUIDANCE } from 'src/bridge/ts/runner/constants';
import type { PlacementFunctionNode } from 'src/bridge/ts/runner/types';


/** Responsibilities: _compute module boundaries placement_. **/
export class PlacementSupport {
	public readonly PLACEMENT_MESSAGE = 'module is placed deeper than its import boundary';

	public readonly PLACEMENT_HINT =
		'Move the module to the first common directory of its production importers, or isolate it in one focused subdirectory whose name differs from caller directories. Apply this to the module, its exported types, and its functions together.';

	/** Responsibilities: _resolution Python package root_. **/
	private python_package_root(root: string, file: string): string {
		if (!file.endsWith('.py')) {
			return '';
		}
		let directory = dirname(file);
		while (directory.startsWith(root)) {
			if (existsSync(join(directory, '__init__.py'))) {
				return directory;
			}
			if (directory === root) {
				break;
			}
			directory = dirname(directory);
		}
		return '';
	}

	/** Responsibilities: _extraction path parts importer_. **/
	private boundary_path_parts(root: string, boundary: string, file: string): string[] {
		if (boundary.length === 0 || !file.startsWith(`${boundary}/`)) {
			return this.path_parts(root, file);
		}
		return relative(boundary, dirname(file)).split('/').filter(Boolean);
	}

	/** Responsibilities: _classification importers share focused_. **/
	private focused_folder_distinct(
		target_parts: string[],
		common: string[],
		importer_parts: string[][]
	): boolean {
		const focused_folder = target_parts[common.length];
		if (focused_folder === undefined) {
			return false;
		}
		return importer_parts.every(parts => !parts.slice(common.length).includes(focused_folder));
	}

	/** Responsibilities: _derivation candidate module locations_. **/
	private suggested_locations(
		common: string,
		file_name: string,
		stem: string,
		importer_parts: string[][]
	): string {
		let common_file = `${common}/${file_name}`;
		if (!common) {
			common_file = file_name;
		}
		const caller_folders = new Set(importer_parts.flat());
		let folder = stem;
		if (caller_folders.has(stem)) {
			folder = 'focused';
		}
		let focused_file = `${common}/${folder}/${file_name}`;
		if (!common) {
			focused_file = `${folder}/${file_name}`;
		}
		return `${common_file} or ${focused_file}`;
	}

	/** Responsibilities: _aggregation function-placement violations location_. **/
	public append_function_violations(
		violations: Violation[],
		file: string,
		functions: readonly PlacementFunctionNode[]
	): void {
		const function_placement_rule = new DiagnosticRule('function-placement');

		const normalized_file = file.replaceAll('\\', '/');
		if (['functions.ts', 'functions.tsx', 'functions.py'].includes(normalized_file)) {
			return;
		}
		for (const node of functions) {
			violations.push(function_placement_rule.violation(file, node.start + 1, {
				ext: extname(file).slice(1),
			}));
		}
	}

	/** Responsibilities: _normalization source path repository-relative_. **/
	public path_parts(root: string, file: string): string[] {
		const directory = dirname(file);
		const relative_directory = relative(root, directory).replaceAll('\\', '/');
		if (relative_directory.length === 0) {
			return [];
		}
		return relative_directory.split('/').filter(Boolean);
	}

	/** Responsibilities: _discovery shared path prefix_. **/
	public common_parts(paths: string[][]): string[] {
		if (paths.length === 0) {
			return [];
		}
		const result: string[] = [];
		for (let index = 0; ; index += 1) {
			const part = paths[0][index];
if (part === undefined || paths.some(path => path[index] !== part)) {
				return result;
			}
			result.push(part);
		}
	}

	/** Responsibilities: _classification target path valid_. **/
	public placement_candidate(root: string, target: string, importers: string[]): boolean {
		const boundary = this.python_package_root(root, target);
		const target_parts = this.boundary_path_parts(root, boundary, target);
		if (boundary.length > 0 && target_parts.length === 0) {
			return false;
		}
		const importer_parts = importers.map(file => this.boundary_path_parts(root, boundary, file));
		const common = this.common_parts(importer_parts);
if (target_parts.length > common.length && this.focused_folder_distinct(target_parts, common, importer_parts)) {
			return false;
		}
		if (importers.length === 1) {
			return target_parts.join('/') !== importer_parts[0].join('/');
		}
		return target_parts.length - common.length >= 2;
	}

	/** Responsibilities: _construction diagnostic parameters module-placement_. **/
	public placement_parameters(root: string, target: string, importers: string[]): RuleParameters {
		const names = importers
			.map(file => relative(root, file))
			.sort()
			.join(', ');
		const boundary = this.python_package_root(root, target);
		const importer_parts = importers.map(file => this.boundary_path_parts(root, boundary, file));
		const common = this.common_parts(importer_parts).join('/');
		const file_name = basename(target);
		const stem = file_name.slice(0, -extname(file_name).length);
		const suggestions = this.suggested_locations(common, file_name, stem, importer_parts);
		return {
			target: relative(root, target),
			importers: names,
			placement_message: this.PLACEMENT_MESSAGE,
			suggestions,
			guidance: PLACEMENT_DIAGNOSTIC_GUIDANCE,
		};
	}
}
