import { basename, dirname, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskWorkspace } from "src/core/support/task/task_workspace";

describe("task workspace in-memory lifecycle", () => {
	test("publishes report files and rule documents using the virtual transaction", () => {
		const root = "/virtual/task-publication-project";
		const file_io = new InMemoryFileIO();
		file_io.directory_operations.create_directory(root);
		const workspace = new TaskWorkspace(root, file_io);
		const rule_id = "parse-error";
		const staged_rules = join(root, "staged-rules");
		file_io.directory_operations.create_directory(staged_rules);
		file_io.file_content.write_text(
			join(staged_rules, basename(workspace.documents.rule_document_path(rule_id))),
			"# Parse error\n",
		);
		const documents_root = join(root, ".ai-code-guard");

		workspace.batch.replace({
			staged_rules,
			rule_ids: [rule_id],
			issues: "# Issues\n",
			documents: new Map([
				["report", "# Report\n"],
				["lint-output", "Lint summary\n"],
			]),
		});

		expect({
			issues: file_io.file_content.file_text(join(documents_root, "issues.md")),
			report: file_io.file_content.file_text(join(documents_root, "report.md")),
			lint_output: file_io.file_content.file_text(join(documents_root, "lint-output.md")),
			rule: file_io.file_content.file_text(workspace.documents.rule_document_path(rule_id)),
			lock_exists: file_io.file_paths.path_exists(join(documents_root, ".task-publication-lock")),
			transaction_entries: file_io.directory_entries
				.list_entries(dirname(documents_root))
				.filter((entry) => entry.name.startsWith(".ai-code-guard-task-")),
		}).toEqual({
			issues: "# Issues\n",
			report: "# Report\n",
			lint_output: "Lint summary\n",
			rule: "# Parse error\n",
			lock_exists: false,
			transaction_entries: [],
		});
	});

	test("clears task documents and rules while preserving review findings", () => {
		const root = "/virtual/task-workspace-clear-project";
		const file_io = new InMemoryFileIO();
		const workspace = new TaskWorkspace(root, file_io);
		const review_file = join(root, ".ai-code-guard", "review", "finding.md");
		const rule_file = join(root, ".ai-code-guard", "rules", "parse-error.md");
		file_io.directory_operations.create_directory(dirname(review_file));
		file_io.directory_operations.create_directory(dirname(rule_file));
		file_io.file_content.write_text(review_file, "open review\n");
		file_io.file_content.write_text(rule_file, "rule documentation\n");
		workspace.documents.write_document("issues", "current issues");

		workspace.clear_batch();

		expect({
			issues_exist: file_io.file_paths.path_exists(workspace.documents.path_for_document("issues")),
			rules_exist: file_io.file_paths.path_exists(dirname(rule_file)),
			review: file_io.file_content.file_text(review_file),
		}).toEqual({ issues_exist: false, rules_exist: true, review: "open review\n" });
	});
});
