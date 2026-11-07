import { dirname, relative, resolve } from "node:path";
import { IGNORED_DIRS, MARKDOWN_TEXT_SUFFIXES } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import type { GitIgnoredPathsContract, TextFileProjectContract, TextFileProjectOptions } from "src/runtime_protocols";
import type { NonEnglishSourceTextRulesContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _project text file discovery_, _non-English text reporting_. **/
export class TextFileProject implements TextFileProjectContract {
	private readonly _repo_root: string;
	private readonly _configured_ignored: ReadonlySet<string>;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _text_rules: NonEnglishSourceTextRulesContract;
	private readonly _git_ignored_paths: GitIgnoredPathsContract;
	private readonly _text_suffixes: readonly string[];

	/** Responsibilities: _text directory exclusion_. **/
	private ignored_path(file: string): boolean {
		let directory = dirname(file);
		while (directory !== this._repo_root) {
			if (IGNORED_DIRS.has(directory.slice(directory.lastIndexOf("/") + 1))) {
				return true;
			}
			if (this._configured_ignored.has(directory.replaceAll("\\", "/"))) {
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

	/** Responsibilities: _text project context_. **/
	public constructor(options: TextFileProjectOptions) {
		this._repo_root = resolve(options.repo_root).replaceAll("\\", "/");
		this._configured_ignored = options.configured_ignored;
		this._source_io = options.source_io;
		this._text_rules = new NonEnglishSourceTextRules(new DiagnosticRule("non-english-source-text"));
		this._git_ignored_paths = options.git_ignored_paths;
		this._text_suffixes = [...MARKDOWN_TEXT_SUFFIXES, ".txt", ".text", ".rst", ".adoc"];
	}

	/** Responsibilities: _raw project text paths_. **/
	public files_unfiltered(): string[] {
		return this.files_unfiltered_from(this._source_io.source_paths(this._repo_root, IGNORED_DIRS));
	}

	/** Responsibilities: _project text file selection_. **/
	public files_unfiltered_from(paths: readonly string[]): string[] {
		const files = paths.filter((path) => {
			const relative_path = relative(this._repo_root, path);
			if (relative_path === ".." || relative_path.startsWith("../")) {
				return false;
			}
			if (this.ignored_path(path)) {
				return false;
			}
			const file_name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
			return this._text_suffixes.some((suffix) => file_name.endsWith(suffix));
		});
		files.sort();
		return files;
	}

	/** Responsibilities: _Git-filtered project text paths_. **/
	public files(): string[] {
		return this._git_ignored_paths.filter(this.files_unfiltered());
	}

	/** Responsibilities: _project text violations_. **/
	public violations(source_texts: ReadonlyMap<string, string>): ViolationContract[] {
		return this.violations_for_files(this.files(), source_texts);
	}

	/** Responsibilities: _text rule evaluation_. **/
	public violations_for_files(
		files: readonly string[],
		source_texts: ReadonlyMap<string, string>,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const file of files) {
			const relative_file = relative(this._repo_root, file).split("\\").join("/");
			let source_text = source_texts.get(file);
			if (source_text === undefined) {
				source_text = this._source_io.source_text(file);
			}
			violations.push(...this._text_rules.text_file_violations(relative_file, source_text));
		}
		return violations;
	}
}
