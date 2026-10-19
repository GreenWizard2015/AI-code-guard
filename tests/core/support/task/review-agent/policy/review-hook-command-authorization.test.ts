import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewPathPolicy } from "src/core/support/task/review-agent/policy/review_path_policy";
import { ReviewReadPolicy } from "src/core/support/task/review-agent/policy/review_read_policy";
import { NodeFileIO } from "src/io/node_file_io";

describe("review hook command authorization", () => {
	test("rejects every Git command during review", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const commands = [
			"git status",
			"git diff",
			"git show HEAD:src/core/cli.ts",
			"git ls-files",
			"git -C /tmp status",
			"/usr/bin/git status",
		];
		expect(commands.map((command) => policy.read_only(command))).toEqual(commands.map(() => false));
	});

	test("rejects Git pathspec and archive access attempts", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			pathspec_flags: policy.read_only("git diff -- --no-pager --no-ext-diff --no-textconv"),
			options_before_pathspec: policy.read_only("git --no-pager diff --no-ext-diff --no-textconv -- src/file.ts"),
			resolved_review: policy.read_only("git show HEAD:.ai-code-guard/resolved-review/finding.md"),
		}).toEqual({ pathspec_flags: false, options_before_pathspec: false, resolved_review: false });
	});

	test("rejects removed interpreter and file-search commands", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			sed_execution: policy.read_only("sed -n '1e rm -- .ai-code-guard/review/finding.md' package.json"),
			find_output: policy.read_only("find . -fls /absolute/path/file"),
			sed_read: policy.read_only("sed -n '1,20p' package.json"),
			find_read: policy.read_only("find . -type f -name '*.ts' -o -name '*.tsx' -print"),
			quoted_pipe: policy.read_only("rg -n 'review-agent|agent-hooks' src"),
		}).toEqual({ sed_execution: false, find_output: false, sed_read: true, find_read: false, quoted_pipe: true });
	});

	test("allows read-only sed and awk line printing", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			sed: policy.read_only("sed -n '1,20p' package.json"),
			awk: policy.read_only("awk 'NR <= 20 { print }' package.json"),
			awk_range: policy.read_only("awk 'NR >= 10 && NR <= 20 { print }' package.json"),
		}).toEqual({ sed: true, awk: true, awk_range: true });
	});

	test("allows read-only grep and absolute paths", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			bare: policy.read_only("grep -n review-agent src/core/support/task/review-agent"),
			absolute: policy.read_only("/usr/bin/grep -n review-agent src/core/support/task/review-agent"),
		}).toEqual({ bare: true, absolute: true });
		expect({
			cat: policy.read_only("/bin/cat package.json"),
			sed: policy.read_only("/usr/bin/sed -n '1,20p' package.json"),
		}).toEqual({ cat: true, sed: true });
	});

	test("rejects project-local executables that only reuse a trusted basename", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect(policy.read_only("/tmp/cat package.json")).toBe(false);
	});

	test("rejects write-capable awk programs", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		const commands = [
			"awk '{ system(\"rm -f finding.md\") }' package.json",
			"awk '{ print > \"output.txt\" }' package.json",
			"awk 'NR <= 20 { next }' package.json",
		];
		expect(commands.every((command) => !policy.read_only(command))).toBe(true);
	});

	test("confines shell and native reads to the project root", () => {
		const policy = new ReviewReadPolicy(new ReviewPathPolicy(new NodeFileIO()));
		expect({
			project_file: policy.read_only("cat package.json", process.cwd()),
			host_file: policy.read_only("cat /etc/passwd", process.cwd()),
			foreign_git: policy.read_only("git -C /tmp status", process.cwd()),
			followed_rg: policy.read_only("rg --follow secret .", process.cwd()),
			followed_find: policy.read_only("find -L . -type f -print", process.cwd()),
		}).toEqual({
			project_file: true,
			host_file: false,
			foreign_git: false,
			followed_rg: false,
			followed_find: false,
		});
	});
});
