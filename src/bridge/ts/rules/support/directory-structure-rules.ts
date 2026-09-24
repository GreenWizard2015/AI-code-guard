import { readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { dirname } from 'node:path';
import { basename } from 'node:path';
import { join } from 'node:path';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import {
	MAX_DIRECTORY_CLASSES,
	MAX_PER_DIRECTORY,
	MIN_DIRECTORY_CLASSES,
	MIN_PER_DIRECTORY,
} from 'src/constants';
import type { NormalizedAstFile } from 'src/types';
import { IGNORED_DIRECTORIES } from 'src/bridge/ts/rules/constants';
import type { DirectoryViolationContext } from 'src/bridge/ts/rules/types';
import { DirectoryFacadeRules } from 'src/bridge/ts/rules/support/directory-facade-rules';

/** Responsibilities: _directory source class count_. **/
export class DirectoryStructureRules {
	private readonly ignored_directories: ReadonlySet<string> = IGNORED_DIRECTORIES;
	private readonly minimum_files = MIN_PER_DIRECTORY;
	private readonly maximum_files = MAX_PER_DIRECTORY;
	private readonly special_file_names = new Set([
		'constants.ts', 'constants.py', 'types.ts', 'types.py', 'protocols.ts', 'protocols.py',
	]);
	private readonly facade_rules = new DirectoryFacadeRules();

	/** Responsibilities: _collection directories containing supported_. **/
	private directories_with_code(files: string[]): Set<string> {
		const directories = new Set<string>();
		for (const file of files) {
			directories.add(dirname(file));
		}
		return directories;
	}

	/** Responsibilities: _direct source file count_. **/
	private direct_file_count(directory: string): number {
		const entries = readdirSync(directory, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || this.ignored_directories.has(entry.name)) {
				continue;
			}
			const child_entries = readdirSync(join(directory, entry.name), { withFileTypes: true });
			if (child_entries.length > 0) {
				return 0;
			}
		}
		return entries.filter(entry => {
			if (!entry.isFile()) {
				return false;
			}
return basename(entry.name) !== '__init__.py' && !this.special_file_names.has(entry.name);
		}).length;
	}

	/** Responsibilities: _selection directory-size rule file_. **/
	private directory_rule(file_count: number): string {
		if (file_count === 0) {
			return '';
		}
		if (file_count < this.minimum_files) {
			return 'directory-min-size';
		}
		if (file_count > this.maximum_files) {
			return 'directory-max-size';
		}
		return '';
	}

	/** Responsibilities: _selection source files directly_. **/
	private direct_source_files(files: string[], directory: string): string[] {
		return files.filter(file => {
			if (dirname(file) !== directory) {
				return false;
			}
			return file.endsWith('.ts') || file.endsWith('.py');
		});
	}


	/** Responsibilities: _aggregation class counts direct_. **/
	private class_count(files: string[], class_counts: ReadonlyMap<string, number>): number {
		let count = 0;
		for (const file of files) {
			if (this.special_file_names.has(basename(file))) {
				continue;
			}
			const current_count = class_counts.get(file);
			if (current_count !== undefined) {
				count += current_count;
			}
		}
		return count;
	}

	/** Responsibilities: _selection directory-class rule class_. **/
	private class_rule(class_count: number): string {
		if (class_count > MAX_DIRECTORY_CLASSES) {
			return 'directory-class-max-size';
		}
		if (class_count > 0 && class_count < MIN_DIRECTORY_CLASSES) {
			return 'directory-class-min-size';
		}
		return '';
	}

	/** Responsibilities: _creation directory class-count violation_. **/
	private directory_class_violation(
		directory: string,
		repo_root: string,
		files: string[],
		class_counts: ReadonlyMap<string, number>
	): Violation[] {
		const source_files = this.direct_source_files(files, directory);
		if (source_files.length === 0) {
			return [];
		}
		const class_count = this.class_count(source_files, class_counts);
		const rule_id = this.class_rule(class_count);
		if (rule_id.length === 0) {
			return [];
		}
		const rule = new DiagnosticRule(rule_id);
		return [rule.violation(relative(repo_root, directory), 1, {
			count: String(class_count),
		})];
	}

	/** Responsibilities: _aggregation file-count class-count violations_. **/
	private append_directory(
		violations: Violation[],
		directory: string,
		context: DirectoryViolationContext
	): void {
		violations.push(...this.directory_violation(directory, context.repo_root));
		violations.push(...this.directory_class_violation(
			directory,
			context.repo_root,
			context.files,
			context.class_counts
		));
		violations.push(...this.facade_rules.facade_violations(
			directory,
			context.repo_root,
			context.files,
			context.source_asts
		));
	}

	/** Responsibilities: _collection structure violations directory_. **/
	public directory_violation(directory: string, repo_root: string): Violation[] {
		const file_count = this.direct_file_count(directory);
		const rule_id = this.directory_rule(file_count);
		if (rule_id.length === 0) {
			return [];
		}
		const rule = new DiagnosticRule(rule_id);
		return [rule.violation(relative(repo_root, directory), 1, {
			count: String(file_count),
		})];
	}

	/** Responsibilities: _aggregation structure violations directories_. **/
	public append_directory_violations(
		violations: Violation[],
		files: string[],
		repo_root: string,
		class_counts: ReadonlyMap<string, number>,
		source_asts: ReadonlyMap<string, NormalizedAstFile>
	): void {
		const context: DirectoryViolationContext = {
			files,
			repo_root,
			class_counts,
			source_asts,
		};
		for (const directory of this.directories_with_code(files)) {
			this.append_directory(violations, directory, context);
		}
	}
}
