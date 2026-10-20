import { GitIgnoreGlobMatcher } from "src/core/support/git_ignore_glob_matcher";
import { LiteralGitIgnoreGlobToken } from "src/core/support/git_ignore_tokens/literal_git_ignore_glob_token";
import { GitIgnorePatternCatalog } from "src/core/support/git_ignore_pattern_catalog";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("GitIgnoreGlobMatcher", () => {
	test("reuses a pattern result for a repeated candidate", () => {
		const matcher = new GitIgnoreGlobMatcher([new LiteralGitIgnoreGlobToken("x")]);
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
});
