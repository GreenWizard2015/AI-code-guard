import { dirname, relative, resolve } from "node:path";
import { IGNORED_DIRS, MARKDOWN_TEXT_SUFFIXES } from "src/constants";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import type { TextFileDiscoveryContract } from "src/runtime_protocols";
import type { GitIgnoredPathsContract } from "src/runtime_protocols";
import type { NonEnglishSourceTextRulesContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _text file traversal_, _non-English text diagnostics_. **/
export class TextFileDiscovery implements TextFileDiscoveryContract {
	private readonly ignored_directories = IGNORED_DIRS;
	private readonly text_suffixes = [...MARKDOWN_TEXT_SUFFIXES, ".txt", ".text", ".rst", ".adoc"];
	private readonly text_rules: NonEnglishSourceTextRulesContract;
	private readonly source_io: ProjectSourceIOContract;
	private readonly git_ignored_paths: Map<string, GitIgnoredPathsContract>;

	/** Responsibilities: _Git ignore path filtering_. **/
	private git_filter(repo_root: string): GitIgnoredPathsContract {
		const existing = this.git_ignored_paths.get(repo_root);
		if (existing !== undefined) {
			return existing;
		}
		const created = new GitIgnoredPaths(repo_root, this.source_io);
		this.git_ignored_paths.set(repo_root, created);
		return created;
	}

	/** Responsibilities: _text directory traversal_. **/
	private ignored_path(file: string, repo_root: string, configured_ignored: ReadonlySet<string>): boolean {
		let directory = dirname(file);
		while (directory !== repo_root && relative(repo_root, directory) !== "..") {
			if (this.ignored_directories.has(directory.slice(directory.lastIndexOf("/") + 1))) {
				return true;
			}
			if (configured_ignored.has(directory.replaceAll("\\", "/"))) {
				return true;
			}
			const parent = dirname(directory);
			if (parent === directory) {
				return true;
			}
			directory = parent;
		}
		return false;
	}

	/** Responsibilities: _text discovery rule initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this.git_ignored_paths = new Map<string, GitIgnoredPathsContract>();
		this.text_rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		this.source_io = source_io;
	}

	/** Responsibilities: _text path collection_. **/
	public files(repo_root: string, configured_ignored: ReadonlySet<string>): string[] {
		return this.git_filter(repo_root).filter(this.files_unfiltered(repo_root, configured_ignored));
	}

	/** Responsibilities: _raw text files_. **/
	public files_unfiltered(repo_root: string, configured_ignored: ReadonlySet<string>): string[] {
		const root = resolve(repo_root).replaceAll("\\", "/");
		const files = this.source_io.source_paths(root, this.ignored_directories).filter((path) => {
			const relative_path = relative(root, path);
			if (relative_path === ".." || relative_path.startsWith("../")) {
				return false;
			}
			if (this.ignored_path(path, root, configured_ignored)) {
				return false;
			}
			const file_name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
			return this.text_suffixes.some((suffix) => file_name.endsWith(suffix));
		});
		files.sort();
		return files;
	}

	/** Responsibilities: _non-English text violations_. **/
	public violations(
		repo_root: string,
		configured_ignored: ReadonlySet<string>,
		source_texts: ReadonlyMap<string, string>,
	): ViolationContract[] {
		return this.violations_for_files(this.files(repo_root, configured_ignored), repo_root, source_texts);
	}

	/** Responsibilities: _text-file validation_. **/
	public violations_for_files(
		files: readonly string[],
		repo_root: string,
		source_texts: ReadonlyMap<string, string>,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const file of files) {
			const relative_file = relative(repo_root, file).split("\\").join("/");
			let source_text = source_texts.get(file);
			if (source_text === undefined) {
				source_text = this.source_io.source_text(file);
			}
			violations.push(...this.text_rules.text_file_violations(relative_file, source_text));
		}
		return violations;
	}
}
