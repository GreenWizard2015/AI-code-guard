import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { NodeFileIO } from "src/io/node_file_io";

describe("review hook path expansion", () => {
	test("rejects shell expansion and uncontrolled glob reads", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			home_expansion: policy.read_only('cat "$HOME/.ssh/id_rsa"', process.cwd()),
			glob_expansion: policy.read_only("cat ../*.pem", process.cwd()),
			escaped_host: policy.read_only(String.raw`cat \/etc/passwd`, process.cwd()),
			tilde_expansion: policy.read_only("cat ~/.ssh/id_rsa", process.cwd()),
			quoted_host: policy.read_only("cat '/etc/passwd'", process.cwd()),
			quoted_parent: policy.read_only("cat '../package.json'", process.cwd()),
			quoted_literal: policy.read_only("cat 'package.json'", process.cwd()),
		}).toEqual({
			home_expansion: false,
			glob_expansion: false,
			escaped_host: false,
			tilde_expansion: false,
			quoted_host: false,
			quoted_parent: false,
			quoted_literal: true,
		});
	});

	test("rejects quote concatenation and unquoted glob expansion", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			concatenated_parent: policy.read_only("cat src/..''/..''/etc/passwd", process.cwd()),
			unquoted_glob: policy.read_only("cat src/*.ts", process.cwd()),
			quoted_literal: policy.read_only("cat 'src/*.ts'", process.cwd()),
		}).toEqual({ concatenated_parent: false, unquoted_glob: false, quoted_literal: true });
	});
});
