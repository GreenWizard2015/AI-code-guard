import type { ProjectSourceIOContract } from "src/protocols";
import { GitIgnoreGlobMatcher } from "src/core/support/git_ignore_glob_matcher";
import { CharacterClassGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/character_class_git_ignore_glob_token";
import { LiteralGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/literal_git_ignore_glob_token";
import { RecursiveDirectoryGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/recursive_directory_git_ignore_glob_token";
import { RecursiveStarGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/recursive_star_git_ignore_glob_token";
import { SingleCharacterGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/single_character_git_ignore_glob_token";
import { SingleStarGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/single_star_git_ignore_glob_token";
import type { GitIgnorePattern, GitIgnorePatternDetails, GitIgnoreSourceFile } from "src/types";
import type { GitIgnoreGlobTokenContract } from "src/protocols";

/** Responsibilities: _Gitignore line parsing_, _glob matcher construction_. **/
export class GitIgnorePatternCatalog {
	private readonly patterns_by_file: Map<string, readonly GitIgnorePattern[]>;
	private readonly source_io: ProjectSourceIOContract;

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
		const escaped_leading_marker = value.startsWith("\\!") || value.startsWith("\\#");
		if (escaped_leading_marker) {
			value = value.slice(1);
		} else if (value.startsWith("!")) {
			negated = true;
			value = value.slice(1);
		}
		return { value, negated, anchored: false, directory_only: false };
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

	/** Responsibilities: _Gitignore character-class parsing_. **/
	private append_character_class(pattern: string, index: number, tokens: GitIgnoreGlobTokenContract[]): number {
		const end = pattern.indexOf("]", index + 1);
		if (end < 0) {
			throw new SyntaxError(`Unclosed character class in Gitignore pattern: ${pattern}`);
		}
		let value = pattern.slice(index + 1, end);
		if (value.startsWith("!")) {
			value = `^${value.slice(1)}`;
		}
		const expression = new RegExp(`^(?:[${value}])$`);
		tokens.push(new CharacterClassGitIgnoreGlobToken(expression, end));
		return end - index;
	}

	/** Responsibilities: _literal token construction_. **/
	private append_escape(pattern: string, index: number, tokens: GitIgnoreGlobTokenContract[]): number {
		const escaped = pattern[index + 1];
		if (escaped === undefined) {
			tokens.push(new LiteralGitIgnoreGlobToken("\\"));
			return 0;
		}
		tokens.push(new LiteralGitIgnoreGlobToken(escaped));
		return 1;
	}

	/** Responsibilities: _Gitignore star pattern parsing_. **/
	private append_star(pattern: string, index: number, tokens: GitIgnoreGlobTokenContract[]): number {
		if (pattern[index + 1] !== "*") {
			tokens.push(new SingleStarGitIgnoreGlobToken());
			return 0;
		}
		if (pattern[index + 2] === "/") {
			tokens.push(new RecursiveDirectoryGitIgnoreGlobToken());
			return 2;
		}
		tokens.push(new RecursiveStarGitIgnoreGlobToken());
		return 1;
	}

	/** Responsibilities: _Gitignore glob token parsing_. **/
	private append_token(pattern: string, index: number, tokens: GitIgnoreGlobTokenContract[]): number {
		const character = pattern[index];
		switch (character) {
			case "\\":
				return this.append_escape(pattern, index, tokens);
			case "*":
				return this.append_star(pattern, index, tokens);
			case "?":
				tokens.push(new SingleCharacterGitIgnoreGlobToken());
				return 0;
			case "[":
				return this.append_character_class(pattern, index, tokens);
			case undefined:
				return 0;
			default:
				tokens.push(new LiteralGitIgnoreGlobToken(character));
				return 0;
		}
	}

	/** Responsibilities: _Gitignore pattern tokenization_. **/
	private tokenize(pattern: string): GitIgnoreGlobTokenContract[] {
		const tokens: GitIgnoreGlobTokenContract[] = [];
		for (let index = 0; index < pattern.length; index += 1) {
			index += this.append_token(pattern, index, tokens);
		}
		return tokens;
	}

	/** Responsibilities: _ignore file pattern collection_. **/
	/** Responsibilities: _field initialization_. **/
	constructor(source_io: ProjectSourceIOContract) {
		this.patterns_by_file = new Map<string, readonly GitIgnorePattern[]>();
		this.source_io = source_io;
	}
	/** Responsibilities: _public operation_. **/
	public patterns_from_file(file: string, base_directory: string): readonly GitIgnorePattern[] {
		const cached = this.patterns_by_file.get(file);
		if (cached !== undefined) {
			return cached;
		}
		if (!this.source_io.source_available(file)) {
			this.patterns_by_file.set(file, []);
			return [];
		}
		const patterns: GitIgnorePattern[] = [];
		for (const line of this.source_io.source_text(file).split("\n")) {
			this.append_line(base_directory, line, patterns);
		}
		this.patterns_by_file.set(file, patterns);
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
