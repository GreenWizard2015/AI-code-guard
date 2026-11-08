import { basename, dirname, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskBatchReplacement } from "src/core/support/task/reporting/workspace/task_batch_replacement";
import { TaskWorkspace } from "src/core/support/task/reporting/workspace/task_workspace";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskPublicationFaultScenario } from "tests/bridge/ts/core/support/task-publication-fault-scenario";

describe("task workspace in-memory lifecycle", () => {
	test("publishes report files and rule documents using the virtual transaction", () => {
		const root = "/virtual/task-publication-project";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(root);
		const workspace_root = join(root, ".ai-code-guard");
		const workspace = new TaskWorkspace(root, file_io);
		const batch = new TaskBatchReplacement(workspace, workspace_root, join(workspace_root, "rules"), file_io);
		const rule_id = "parse-error";
		const staged_rules = join(root, "staged-rules");
		file_io.create_directory(staged_rules);
		file_io.file(join(staged_rules, basename(workspace.rule_document_path(rule_id)))).write_text("# Parse error\n");
		const documents_root = join(root, ".ai-code-guard");

		batch.replace({
			staged_rules,
			rule_ids: [rule_id],
			issues: "# Issues\n",
			documents: new Map([
				["report", "# Report\n"],
				["lint-output", "Lint summary\n"],
			]),
		});

		expect({
			issues: file_io.file(join(documents_root, "issues.md")).file_text(),
			report: file_io.file(join(documents_root, "report.md")).file_text(),
			lint_output: file_io.file(join(documents_root, "lint-output.md")).file_text(),
			rule: file_io.file(workspace.rule_document_path(rule_id)).file_text(),
			lock_exists: file_io.file(join(documents_root, ".task-publication-lock")).path_exists(),
			transaction_entries: file_io
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
		file_io.create_directory(dirname(review_file));
		file_io.create_directory(dirname(rule_file));
		file_io.file(review_file).write_text("open review\n");
		file_io.file(rule_file).write_text("rule documentation\n");
		workspace.write_document("issues", "current issues");

		workspace.clear_batch();

		expect({
			issues_exist: file_io.file(workspace.path_for_document("issues")).path_exists(),
			rules_exist: file_io.file(dirname(rule_file)).path_exists(),
			rule_exists: file_io.file(rule_file).path_exists(),
			rule_entries: file_io.list_files(dirname(rule_file)),
			review: file_io.file(review_file).file_text(),
		}).toEqual({
			issues_exist: false,
			rules_exist: true,
			rule_exists: false,
			rule_entries: [],
			review: "open review\n",
		});
	});

	test("leaves no published transaction owner when journal initialization fails", async () => {
		const scenario = new TaskPublicationFaultScenario("/virtual/task-publication-journal-failure");
		const file_io = scenario.file_io();
		const workspace = new TaskWorkspace(scenario.root(), file_io);
		const batch = new TaskBatchReplacement(workspace, scenario.workspace_root(), scenario.rules_root(), file_io);
		scenario.stage_rule("new rule\n");
		file_io.fail_next_journal_initialization();
		file_io.fail_next_transaction_cleanup();
		const replacement_outcome = await Promise.resolve()
			.then(() => batch.replace(scenario.request("next issues", "next report")))
			.then(
				() => ({ failure_message: "" }),
				(error) => ({ failure_message: error.message }),
			);
		const retained = scenario.retained_state();
		batch.replace(scenario.request("next issues", "next report"));
		const published = scenario.published_state();
		expect({ failure_message: replacement_outcome.failure_message, retained, published }).toEqual({
			failure_message: expect.stringContaining("injected journal initialization failure"),
			retained: {
				transaction_exists: true,
				transaction_listed: true,
				owner_exists: true,
				owner_references_transaction: false,
				issues: "previous issues\n",
				report: "previous report\n",
				rule: "previous rule\n",
				backup_issues: "",
				backup_report: "",
				backup_rule: "",
			},
			published: {
				transactions_removed: true,
				issues: "next issues\n",
				report: "next report\n",
				rule: "new rule\n",
			},
		});
	});

	test("retains committed files and backups after cleanup failure until retry", async () => {
		const scenario = new TaskPublicationFaultScenario("/virtual/task-publication-cleanup-failure");
		const file_io = scenario.file_io();
		const workspace = new TaskWorkspace(scenario.root(), file_io);
		const batch = new TaskBatchReplacement(workspace, scenario.workspace_root(), scenario.rules_root(), file_io);
		scenario.stage_rule("first published rule\n");
		file_io.fail_next_transaction_cleanup();
		const replacement_outcome = await Promise.resolve()
			.then(() => batch.replace(scenario.request("first published issues", "first published report")))
			.then(
				() => ({ failure_message: "" }),
				(error) => ({ failure_message: error.message }),
			);
		const retained = scenario.retained_state();
		scenario.stage_rule("retry published rule\n");
		batch.replace(scenario.request("retry published issues", "retry published report"));
		const published = scenario.published_state();
		expect({ failure_message: replacement_outcome.failure_message, retained, published }).toEqual({
			failure_message: expect.stringContaining("injected transaction cleanup failure"),
			retained: {
				transaction_exists: true,
				transaction_listed: true,
				owner_exists: true,
				owner_references_transaction: true,
				issues: "first published issues\n",
				report: "first published report\n",
				rule: "first published rule\n",
				backup_issues: "previous issues\n",
				backup_report: "previous report\n",
				backup_rule: "previous rule\n",
			},
			published: {
				transactions_removed: true,
				issues: "retry published issues\n",
				report: "retry published report\n",
				rule: "retry published rule\n",
			},
		});
	});
});
