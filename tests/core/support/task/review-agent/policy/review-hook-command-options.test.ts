import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { NodeFileIO } from "src/io/node_file_io";

describe("review hook command options", () => {
	test("rejects recursive symlink traversal and additional sed scripts", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			rg_long_follow: policy.read_only("rg --follow -n needle ."),
			rg_short_follow: policy.read_only("rg -L -n needle ."),
			rg_combined_follow: policy.read_only("rg -nL needle ."),
			sed_second_script: policy.read_only("sed -n -e '1p' -e '1wcorrupted.ts' package.json"),
			sed_file_script: policy.read_only("sed -n '1p' -f .ai-code-guard/review/payload.md package.json"),
			sed_long_file_script: policy.read_only("sed -n '1p' --file=.ai-code-guard/review/payload.md package.json"),
			grep_recursive: policy.read_only("grep -R needle ."),
			grep_combined_recursive: policy.read_only("grep -nR needle ."),
			grep_long_recursive: policy.read_only("grep --dereference-recursive needle ."),
			sort_helper: policy.read_only("sort --compress-program=./payload package.json"),
			sort_helper_separate: policy.read_only("sort --compress-program ./payload package.json"),
			sort_manifest: policy.read_only("sort --files0-from=package.json"),
			sort_manifest_separate: policy.read_only("sort --files0-from package.json"),
			sort_manifest_stdin: policy.read_only("sort --files0-from=-"),
			sort_output_cluster: policy.read_only("sort -ro src/constants.ts package.json"),
			sort_output_numeric_cluster: policy.read_only("sort -nro src/constants.ts package.json"),
		}).toEqual({
			rg_long_follow: false,
			rg_short_follow: false,
			rg_combined_follow: false,
			sed_second_script: false,
			sed_file_script: false,
			sed_long_file_script: false,
			grep_recursive: false,
			grep_combined_recursive: false,
			grep_long_recursive: false,
			sort_helper: false,
			sort_helper_separate: false,
			sort_manifest: false,
			sort_manifest_separate: false,
			sort_manifest_stdin: false,
			sort_output_cluster: false,
			sort_output_numeric_cluster: false,
		});
	});

	test("keeps ordinary recursive reads and line printing available", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			rg_read: policy.read_only("rg -n needle src"),
			sed_read: policy.read_only("sed -n '1,20p' package.json"),
			sort_read: policy.read_only("sort -r package.json"),
		}).toEqual({ rg_read: true, sed_read: true, sort_read: true });
	});
});
