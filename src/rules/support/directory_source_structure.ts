import { dirname, isAbsolute, relative, sep } from "node:path";
import { MAX_SOURCE_SUBDIRECTORIES } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ReadonlySourceDirectoryChildren, SourceDirectoryChildMap } from "src/model/types/types";
import type { ViolationContract } from "src/reporting_protocols";
import { DIRECTORY_RULE_IDS } from "src/rules/constants";
import { TestPathSyntax } from "src/test_path_syntax";

/** Responsibilities: _source directory indexing_, _source subdirectory diagnostics_. **/
export class DirectorySourceStructure {
	private readonly test_path_syntax: TestPathSyntax;
	private readonly maximum_source_subdirectories = MAX_SOURCE_SUBDIRECTORIES;

	/** Responsibilities: _implementation source classification_. **/
	private is_project_source(file: string): boolean {
		if (!file.endsWith(".ts") && !file.endsWith(".py")) {
			return false;
		}
		return !this.test_path_syntax.test_file(file);
	}

	/** Responsibilities: _source file indexing_. **/
	private append_source_file(source_files: Map<string, string[]>, file: string): void {
		const directory = dirname(file);
		const current = source_files.get(directory);
		if (current === undefined) {
			source_files.set(directory, [file]);
			return;
		}
		current.push(file);
	}

	/** Responsibilities: _one source-bearing child insertion_. **/
	private add_directory_child(children: SourceDirectoryChildMap, parent: string, child: string): void {
		let names = children.get(parent);
		if (names === undefined) {
			names = new Set<string>();
			children.set(parent, names);
		}
		names.add(child);
	}

	/** Responsibilities: _repo-relative parent validation_. **/
	private outside_project(root_relative_path: string): boolean {
		if (root_relative_path === "..") {
			return true;
		}
		if (root_relative_path.startsWith(`..${sep}`)) {
			return true;
		}
		return isAbsolute(root_relative_path);
	}

	/** Responsibilities: _ancestor directory indexing_. **/
	private add_parent_directories(directories: Set<string>, source_directory: string, repo_root: string): void {
		let child_directory = source_directory;
		while (child_directory !== repo_root) {
			const parent = dirname(child_directory);
			const root_relative_path = relative(repo_root, parent);
			if (this.outside_project(root_relative_path)) {
				break;
			}
			directories.add(parent);
			if (parent === repo_root || parent === child_directory) {
				break;
			}
			child_directory = parent;
		}
	}

	/** Responsibilities: _path syntax initialization_. **/
	public constructor() {
		this.test_path_syntax = new TestPathSyntax();
	}

	/** Responsibilities: _source-bearing child directory indexing_. **/
	public source_directory_children(source_directories: Iterable<string>): SourceDirectoryChildMap {
		const children: SourceDirectoryChildMap = new Map();
		for (const source_directory of source_directories) {
			let child = source_directory;
			while (true) {
				const parent = dirname(child);
				if (parent === child) {
					break;
				}
				this.add_directory_child(children, parent, child);
				child = parent;
			}
		}
		return children;
	}

	/** Responsibilities: _directory candidate selection_. **/
	public directories_to_check(source_directories: Iterable<string>, repo_root: string): Set<string> {
		const source_directory_list = [...source_directories];
		const directories = new Set(source_directory_list);
		for (const source_directory of source_directory_list) {
			this.add_parent_directories(directories, source_directory, repo_root);
		}
		return directories;
	}

	/** Responsibilities: _source subdirectory limit diagnostic_. **/
	public source_subdirectory_violation(
		directory: string,
		repo_root: string,
		source_directory_children: ReadonlySourceDirectoryChildren,
	): ViolationContract[] {
		const children = source_directory_children.get(directory);
		let count = 0;
		if (children !== undefined) {
			count = children.size;
		}
		if (count <= this.maximum_source_subdirectories) {
			return [];
		}
		const rule = new DiagnosticRule(DIRECTORY_RULE_IDS.source_subdirectories_maximum);
		return [rule.violation(relative(repo_root, directory), 1, { count: String(count) })];
	}

	/** Responsibilities: _source directory inventory_. **/
	public source_directories(files: readonly string[]): Map<string, string[]> {
		const source_files = new Map<string, string[]>();
		for (const file of files) {
			if (!this.is_project_source(file)) {
				continue;
			}
			this.append_source_file(source_files, file);
		}
		return source_files;
	}
}
