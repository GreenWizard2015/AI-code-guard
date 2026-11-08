import { GitIgnoreGlobMatcher } from "src/core/support/git_ignore_glob_matcher";
import { CharacterGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/character_git_ignore_glob_token";
import { GitIgnoreGlobCandidateEvaluation } from "src/core/support/git_ignore_tokens/git_ignore_glob_candidate_evaluation";
import { RepeatedGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/repeated_git_ignore_glob_token";
import { GitIgnorePatternCatalog } from "src/git_ignore_pattern_catalog";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("GitIgnoreGlobMatcher", () => {
	test("reuses a pattern result for a repeated candidate", () => {
		const matcher = new GitIgnoreGlobMatcher([new CharacterGitIgnoreGlobToken(/^x$/u)]);
		const first = matcher.match_candidate("x");
		const repeated = matcher.match_candidate("x");
		const no_match = matcher.match_candidate("y");
		const repeated_no_match = matcher.match_candidate("y");

		expect({
			first_match: first.matched,
			repeated_match: repeated.matched,
			repeated_states: repeated.visited_states,
			no_match: no_match.matched,
			repeated_no_match: repeated_no_match.matched,
			repeated_no_match_states: repeated_no_match.visited_states,
		}).toEqual({
			first_match: true,
			repeated_match: true,
			repeated_states: 0,
			no_match: false,
			repeated_no_match: false,
			repeated_no_match_states: 0,
		});
	});

	test("bounds overlapping wildcard matching by pattern and candidate size", () => {
		const pattern = `${"*a".repeat(16)}b*`;
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", pattern]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");
		const candidate = `${"a".repeat(32)}.ts`;
		const results = parsed.map((item) => item.matcher.match_candidate(candidate));
		const maximum_state_visits = (pattern.length + 1) * (candidate.length + 1);

		expect({
			matches: results.map((result) => result.matched),
			visited_states: results.map((result) => result.visited_states),
		}).toEqual({ matches: [false], visited_states: [maximum_state_visits] });
	});

	test("preserves recursive directories, single-character wildcards, and character classes", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", "src/**/file?.[jt]s"]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");
		const root_results = parsed.map((item) => item.matcher.match_candidate("src/file1.ts"));
		const nested_results = parsed.map((item) => item.matcher.match_candidate("src/nested/file2.js"));
		const too_many_results = parsed.map((item) => item.matcher.match_candidate("src/file12.ts"));

		expect({
			root_file: root_results.some((result) => result.matched),
			nested_file: nested_results.some((result) => result.matched),
			too_many_characters: too_many_results.some((result) => result.matched),
		}).toEqual({ root_file: true, nested_file: true, too_many_characters: false });
	});

	test("single-star wildcard does not cross directory boundaries", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", "src/*.ts"]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");

		const root_matches = parsed.map((pattern) => pattern.matcher.match_candidate("src/main.ts").matched);
		const nested_matches = parsed.map((pattern) => pattern.matcher.match_candidate("src/nested/main.ts").matched);

		expect({ root_matches, nested_matches }).toEqual({ root_matches: [true], nested_matches: [false] });
	});

	test("rejects candidates shorter than a pattern's required characters before evaluating states", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", "*.typescript"]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");
		const results = parsed.map((pattern) => pattern.matcher.match_candidate(".ts"));

		expect(results.map((result) => ({ matched: result.matched, visited_states: result.visited_states }))).toEqual([
			{ matched: false, visited_states: 0 },
		]);
	});

	test("rejects wrong lengths for fixed-width patterns before evaluating states", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", "src/file.ts"]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");
		const results = parsed.map((pattern) => pattern.matcher.match_candidate("src/nested/file.ts"));

		expect(results.map((result) => ({ matched: result.matched, visited_states: result.visited_states }))).toEqual([
			{ matched: false, visited_states: 0 },
		]);
	});

	test("matches fixed-width patterns in one state per character", () => {
		const source_io = new InMemoryProjectSourceIO(
			new Map([["/virtual/repo/.gitignore", "fixed-name.ts\nfile?.[jt]s"]]),
		);
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");
		const fixed_matches = parsed.map((pattern) => pattern.matcher.match_candidate("fixed-name.ts"));
		const wildcard_matches = parsed.map((pattern) => pattern.matcher.match_candidate("file1.ts"));

		expect({
			fixed: fixed_matches.map((result) => ({ matched: result.matched, visited_states: result.visited_states })),
			wildcard: wildcard_matches.map((result) => result.matched),
		}).toEqual({
			fixed: [
				{ matched: true, visited_states: "fixed-name.ts".length + 1 },
				{ matched: false, visited_states: 0 },
			],
			wildcard: [false, true],
		});
	});

	test("evaluates variable-width patterns within the bounded state space", () => {
		const wildcard = new RepeatedGitIgnoreGlobToken("*");
		const literal = new CharacterGitIgnoreGlobToken(/^a$/u);
		const evaluation = new GitIgnoreGlobCandidateEvaluation([wildcard, literal], "ba");
		const result = evaluation.match();

		expect({ matched: result.matched, visited_states: result.visited_states }).toEqual({
			matched: true,
			visited_states: 9,
		});
	});

	test("treats escaped wildcard characters as literals", () => {
		const source_io = new InMemoryProjectSourceIO(new Map([["/virtual/repo/.gitignore", "file\\?.ts"]]));
		const catalog = new GitIgnorePatternCatalog(source_io);
		const parsed = catalog.patterns_from_file("/virtual/repo/.gitignore", "/virtual/repo");

		const literal_matches = parsed.map((pattern) => pattern.matcher.match_candidate("file?.ts").matched);
		const other_matches = parsed.map((pattern) => pattern.matcher.match_candidate("file1.ts").matched);

		expect({ literal_matches, other_matches }).toEqual({ literal_matches: [true], other_matches: [false] });
	});
});
