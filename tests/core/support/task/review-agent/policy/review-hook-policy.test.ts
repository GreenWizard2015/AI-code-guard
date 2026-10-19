import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { NodeFileIO } from "src/io/node_file_io";

describe("review hook shell policy", () => {
	test("rejects read and deletion mixed in one command", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const decision = policy.decision("cat package.json; rm -f -- .ai-code-guard/review/finding.md");
		expect({
			allowed: decision.allowed,
			classified_as_read_only: policy.read_only("cat package.json; rm -f -- .ai-code-guard/review/finding.md"),
		}).toEqual({
			allowed: false,
			classified_as_read_only: false,
		});
	});

	test("denies agent access to resolved reviews through paths and recursive reads", () => {
		const path_policy = new ReviewPathPolicy(new NodeFileIO());
		const policy = new ReviewReadPolicy(path_policy);
		const resolved_file = ".ai-code-guard/resolved-review/finding.md";
		expect({
			direct_path: policy.decision(`cat ${resolved_file}`, process.cwd()).allowed,
			read_tool_path: path_policy.allows_read_path(resolved_file, process.cwd()),
			recursive_project_search: policy.decision("rg --hidden -n finding .", process.cwd()).allowed,
			implicit_recursive_search: policy.decision("rg --hidden -n finding", process.cwd()).allowed,
			project_source_search: policy.decision("rg -n finding src", process.cwd()).allowed,
		}).toEqual({
			direct_path: false,
			read_tool_path: false,
			recursive_project_search: false,
			implicit_recursive_search: false,
			project_source_search: true,
		});
	});

	test("allows safe read-only semicolon chaining", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const command = "rg --files src; cat package.json; rg -n review-agent src";
		expect({ allowed: policy.decision(command).allowed, classified_as_read_only: policy.read_only(command) }).toEqual({
			allowed: true,
			classified_as_read_only: true,
		});
	});

	test("allows explicitly supported read-only chaining", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const command = "pwd && head -20 package.json | tail -5";
		expect({ allowed: policy.decision(command).allowed, classified_as_read_only: policy.read_only(command) }).toEqual({
			allowed: true,
			classified_as_read_only: true,
		});
	});

	test("allows Codex read-only commands separated by newlines", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const command = "pwd\nrg --files -g '!node_modules' -g '!vendor' | head -100";
		expect({
			allowed: policy.decision(command, process.cwd()).allowed,
			classified_as_read_only: policy.read_only(command, process.cwd()),
		}).toEqual({
			allowed: true,
			classified_as_read_only: true,
		});
	});

	test("rejects a standalone background operator", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect(policy.read_only("cat package.json & rm -f -- .ai-code-guard/review/finding.md")).toBe(false);
	});

	test("rejects command substitution inside double quotes", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			parenthesized: policy.read_only('cat "$(rm -f .ai-code-guard/review/finding.md)"'),
			backtick: policy.read_only('cat "`rm -f .ai-code-guard/review/finding.md`"'),
			parameter: policy.read_only('cat "${UNTRUSTED_COMMAND}"'),
		}).toEqual({ parenthesized: false, backtick: false, parameter: false });
	});

	test("rejects write-capable options on read commands", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const commands = [
			"sed -i.bak 's/x/y/' src/file.ts",
			"find . -fprint /absolute/path/file",
			"find . -fls /absolute/path/file",
			"sort --output=/absolute/path/file input",
			"git diff --output=/absolute/path/file",
		];
		expect(commands.every((command) => !policy.read_only(command))).toBe(true);
		expect({
			outside_rg: policy.read_only("rg --file=/etc/passwd .", process.cwd()),
			inside_rg: policy.read_only("rg --file=package.json .", process.cwd()),
			outside_grep: policy.read_only("grep --file=/etc/passwd pattern .", process.cwd()),
			inside_sort: policy.read_only("sort --files0-from=package.json", process.cwd()),
		}).toEqual({ outside_rg: false, inside_rg: true, outside_grep: false, inside_sort: false });
	});
});
