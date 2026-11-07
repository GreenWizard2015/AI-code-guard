import { GitIgnoreGlobMatcher } from "src/core/support/git_ignore_glob_matcher";
import { CharacterGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/character_git_ignore_glob_token";
import { DirectoryPrefixGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/directory_prefix_git_ignore_glob_token";
import { QuestionMarkGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/question_mark_git_ignore_glob_token";
import { RepeatedGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/repeated_git_ignore_glob_token";
import type { GitIgnorePattern, GitIgnorePatternDetails, GitIgnoreSourceFile } from "src/project_analysis_types";
import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _Gitignore line parsing_, _glob matcher construction_. **/
export class GitIgnorePatternCatalog {
	private readonly _patterns_by_file: Map<string, readonly GitIgnorePattern[]>;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _ignore line normalization_. **/
	private normalized_line(line: string): string {
		const value = line.replace(/\r$/, "");
		if (value.trim().length === 0) {
			return "";
		}
		if (value.startsWith("#")) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _ignore pattern detail extraction_. **/
	private leading_pattern_details(value: string): GitIgnorePatternDetails {
		let negated = false;
		let pattern = value;
		const escaped_leading_marker = pattern.startsWith("\\!") || pattern.startsWith("\\#");
		if (escaped_leading_marker) {
			pattern = pattern.slice(1);
		} else if (pattern.startsWith("!")) {
			negated = true;
			pattern = pattern.slice(1);
		}
		return { value: pattern, negated, anchored: false, directory_only: false };
	}

	/** Responsibilities: _ignore pattern detail extraction_. **/
	private pattern_details(value: string): GitIgnorePatternDetails {
		const leading = this.leading_pattern_details(value);
		let pattern = leading.value;
		const anchored = pattern.startsWith("/");
		const directory_only = pattern.endsWith("/") && !pattern.endsWith("\\/");
		pattern = pattern.replace(/\/$/, "").replace(/^\//, "").replaceAll("\\/", "/");
		if (pattern.length === 0) {
			return { value: "", negated: leading.negated, anchored, directory_only };
		}
		return { value: pattern, negated: leading.negated, anchored, directory_only };
	}

	/** Responsibilities: _character class token construction_. **/
	private character_class_token(character_class_value: string): GitIgnoreGlobTokenContract {
		let characters = character_class_value.slice(1, -1);
		if (characters.startsWith("!")) {
			characters = `^${characters.slice(1)}`;
		}
		return new CharacterGitIgnoreGlobToken(new RegExp(`^(?:[${characters}])$`));
	}

	/** Responsibilities: _literal wildcard token selection_. **/
	private simple_token(token_value: string): GitIgnoreGlobTokenContract {
		switch (token_value) {
			case "?":
				return new QuestionMarkGitIgnoreGlobToken(token_value);
			case "*":
			case "**":
				return new RepeatedGitIgnoreGlobToken(token_value);
			case "**/":
				return new DirectoryPrefixGitIgnoreGlobToken(token_value);
			default:
				break;
		}
		let literal = token_value;
		if (token_value.startsWith("\\")) {
			literal = token_value.slice(1);
		}
		const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new CharacterGitIgnoreGlobToken(new RegExp(`^(?:${escaped})$`));
	}

	/** Responsibilities: _Gitignore glob token construction_. **/
	private append_token(tokens: GitIgnoreGlobTokenContract[], pattern: string, match: RegExpMatchArray): void {
		const value = match[0];
		if (value === "[") {
			throw new SyntaxError(`Unclosed character class in Gitignore pattern: ${pattern}`);
		}
		if (value.startsWith("[")) {
			tokens.push(this.character_class_token(value));
			return;
		}
		tokens.push(this.simple_token(value));
	}

	/** Responsibilities: _ignore line conversion_. **/
	private append_line(base_directory: string, line: string, patterns: GitIgnorePattern[]): void {
		const normalized = this.normalized_line(line);
		if (normalized.length === 0) {
			return;
		}
		const details = this.pattern_details(normalized);
		if (details.value.length === 0) {
			return;
		}
		patterns.push({
			base_directory,
			negated: details.negated,
			anchored: details.anchored,
			directory_only: details.directory_only,
			pattern: details.value,
			matcher: new GitIgnoreGlobMatcher(this.tokenize(details.value)),
		});
	}

	/** Responsibilities: _Gitignore pattern tokenization_. **/
	private tokenize(pattern: string): GitIgnoreGlobTokenContract[] {
		const tokens: GitIgnoreGlobTokenContract[] = [];
		const token_pattern = /\\[\s\S]|\*\*\/|\*\*|\*|\?|\[[^\]]*\]|[\s\S]/g;
		for (const match of pattern.matchAll(token_pattern)) {
			this.append_token(tokens, pattern, match);
		}
		return tokens;
	}

	/** Responsibilities: _ignore file pattern collection_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(source_io: ProjectSourceIOContract) {
		this._patterns_by_file = new Map<string, readonly GitIgnorePattern[]>();
		this._source_io = source_io;
	}
	/** Responsibilities: _public operation_. **/
	public patterns_from_file(file: string, base_directory: string): readonly GitIgnorePattern[] {
		const cached = this._patterns_by_file.get(file);
		if (cached !== undefined) {
			return cached;
		}
		if (!this._source_io.source_available(file)) {
			this._patterns_by_file.set(file, []);
			return [];
		}
		const patterns: GitIgnorePattern[] = [];
		for (const line of this._source_io.source_text(file).split("\n")) {
			this.append_line(base_directory, line, patterns);
		}
		this._patterns_by_file.set(file, patterns);
		return patterns;
	}

	/** Responsibilities: _ignore file batch collection_. **/
	public patterns_from_files(files: readonly GitIgnoreSourceFile[]): GitIgnorePattern[] {
		const patterns: GitIgnorePattern[] = [];
		for (const source of files) {
			patterns.push(...this.patterns_from_file(source.file, source.base_directory));
		}
		return patterns;
	}
}
