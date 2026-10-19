import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { NodeFileIO } from "src/io/node_file_io";

describe("review hook shell wrappers", () => {
	test("rejects nested Bash login wrappers around reads", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect(policy.read_only("/bin/bash -lc 'rg -n review-agent src'", process.cwd())).toBe(false);
	});

	test("rejects a wrapped write command", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect(
			policy.read_only("/bin/bash -lc 'cat > .ai-code-guard/review/review-boundaries-finding.md'", process.cwd()),
		).toBe(false);
	});

	test("allows read-only rg commands with regex escapes and literal paths", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const command = "rg -n 'identity\\\\(|cached_result' src/core/cache src/type_script_reference.ts; cat src/types.ts";

		expect(policy.read_only(command, process.cwd())).toBe(true);
	});
});
