import { dirname, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskWorkspace } from "src/core/support/task/task_workspace";

describe("task workspace in-memory IO", () => {
	test("writes documents and prepares review directories in virtual storage", () => {
		const root = "/virtual/task-workspace";
		const file_io = new InMemoryFileIO();
		file_io.directory_operations.create_directory(root);
		const workspace = new TaskWorkspace(root, file_io);
		workspace.documents.write_document("issues", "# Issues");
		workspace.documents.write_performance("# Performance");
		workspace.prepare_review();

		const workspace_root = join(root, ".ai-code-guard");
		expect({
			issues: file_io.file_content.file_text(join(workspace_root, "issues.md")),
			performance: file_io.file_content.file_text(join(workspace_root, "performance.md")),
			review_directory: file_io.file_paths.path_exists(join(workspace_root, "review")),
			legacy_prompt: file_io.file_paths.path_exists(join(workspace_root, "architecture-review-prompt.md")),
		}).toEqual({
			issues: "# Issues\n",
			performance: "# Performance\n",
			review_directory: true,
			legacy_prompt: false,
		});
	});

	test("clears stale task output while retaining the review directory", () => {
		const root = "/virtual/task-workspace-clear";
		const file_io = new InMemoryFileIO();
		file_io.directory_operations.create_directory(root);
		const workspace = new TaskWorkspace(root, file_io);
		workspace.documents.write_document("issues", "stale issues");
		const stale_rule = workspace.documents.rule_document_path("parse-error");
		file_io.directory_operations.create_directory(dirname(stale_rule));
		file_io.file_content.write_text(stale_rule, "stale rule");
		workspace.clear_batch();

		const workspace_root = join(root, ".ai-code-guard");
		expect({
			issues: file_io.file_paths.path_exists(join(workspace_root, "issues.md")),
			rules: file_io.file_paths.path_exists(join(workspace_root, "rules")),
			review: file_io.file_paths.path_exists(join(workspace_root, "review")),
		}).toEqual({ issues: false, rules: true, review: true });
	});
});
