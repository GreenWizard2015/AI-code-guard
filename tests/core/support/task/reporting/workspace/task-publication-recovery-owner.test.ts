import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join, resolve } from "node:path";
import { describe, expect, jest, test } from "@jest/globals";
import { TaskPublicationRecovery } from "src/core/support/task/publication/task_publication_recovery";
import { TaskPublicationLock } from "src/core/support/task/reporting/workspace/task_publication_lock";
import type { TaskPublicationRollbackContract } from "src/core/support/task/types";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";
import { OwnerChangeRecovery } from "tests/core/support/task/reporting/workspace/owner_change_recovery";
import { RecoveryOwnerChangeIO } from "tests/core/support/task/reporting/workspace/recovery_owner_change_io";

describe("task publication owner recovery", () => {
	/** Responsibilities: _owner race fixture setup_. **/
	const create_owner_change_setup = (): {
		fixture: TaskReportingMemoryWorkspace<RecoveryOwnerChangeIO>;
		workspace: string;
		lock: string;
		transaction: string;
		replacement_documents: Map<string, string>;
	} => {
		const file_io = new RecoveryOwnerChangeIO();
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create_with_file_io_factory(
			{ "a.ts": "const first = 1;\n", "b.ts": "const first = 1;\n" },
			(root, files) => {
				file_io.seed_files(new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text])));
				return file_io;
			},
		);
		const { _root, _documents, _file_io: io } = fixture;
		const workspace = join(_root, ".ai-code-guard");
		const rules_root = join(workspace, "rules");
		for (const document of ["issues", "report", "lint-output"] as const) {
			_documents.write_document(document, `prior ${document}\n`);
		}
		io.create_directory(rules_root);
		io.file(join(rules_root, "prior-rule.md")).write_text("prior rule\n");
		const transaction = io.temporary_directory(_root, ".ai-code-guard-task-");
		io.move_path(rules_root, join(transaction, "rules"));
		io.create_directory(rules_root);
		io.file(join(rules_root, "partial.md")).write_text("partial\n");
		for (const document of ["issues", "report", "lint-output"] as const) {
			io.move_path(_documents.path_for_document(document), join(transaction, `${document}.md`));
		}
		io.file(join(transaction, "journal")).write_text("1\nissues\nreport\nlint-output");
		const lock = join(workspace, ".task-publication-lock");
		io.create_directory(lock);
		io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\nold-token\n`);
		const replacement_documents = new Map([
			[_documents.path_for_document("issues"), "replacement issues\n"],
			[_documents.path_for_document("report"), "replacement report\n"],
			[_documents.path_for_document("lint-output"), "replacement lint output\n"],
		]);
		io.change_owner_on_journal_read(join(transaction, "journal"), join(lock, "owner"), replacement_documents);
		return { fixture, workspace, lock, transaction, replacement_documents };
	};

	test("rejects a recovery owner change before removing the live lock", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({
			"a.ts": "const first = 1;\n",
			"b.ts": "const first = 1;\n",
		});
		const restore = jest.fn<TaskPublicationRollbackContract["restore"]>();
		const recovery = new OwnerChangeRecovery(fixture, restore);
		const workspace = join(fixture._root, ".ai-code-guard");
		const lock = join(workspace, ".task-publication-lock");
		const publication_lock = new TaskPublicationLock(workspace, recovery, fixture._file_io);
		expect(() => publication_lock.acquire()).toThrow("owner changed during recovery");
		expect({
			lock_exists: fixture._file_io.file(lock).path_exists(),
			claim_exists: fixture._file_io.file(join(lock, "recovery")).path_exists(),
		}).toEqual({
			lock_exists: true,
			claim_exists: false,
		});
	});

	test("preserves replacement documents when ownership changes during journal reading", async () => {
		const setup = create_owner_change_setup();
		const { fixture, workspace, lock, transaction, replacement_documents } = setup;
		const recovery = new TaskPublicationRecovery(fixture._documents, join(workspace, "rules"), fixture._file_io);
		const publication_lock = new TaskPublicationLock(workspace, recovery, fixture._file_io);
		const replacement_document_entries = [...replacement_documents];
		const expected_documents = replacement_document_entries.map(([, document]) => document);
		const failure_message = await Promise.resolve()
			.then(() => publication_lock.acquire())
			.then(
				() => "",
				(reason: unknown) => String(reason),
			);
		const current_documents = replacement_document_entries.map(([path]) => fixture._file_io.file(path).file_text());
		expect({
			owner_changed: failure_message.includes("owner changed during recovery"),
			lock_exists: fixture._file_io.file(lock).path_exists(),
			documents: current_documents,
			transaction_exists: fixture._file_io.file(transaction).path_exists(),
		}).toEqual({
			owner_changed: true,
			lock_exists: true,
			documents: expected_documents,
			transaction_exists: true,
		});
	});
});
