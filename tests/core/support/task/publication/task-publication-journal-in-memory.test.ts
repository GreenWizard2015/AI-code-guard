import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TASK_PUBLICATION_JOURNAL_PREPARED } from "src/core/support/task/constants";
import { TaskPublicationJournalFile } from "src/core/support/task/publication/task_publication_journal_file";

describe("task publication journal in-memory IO", () => {
	test("reads a prepared journal and preserves its previous document set", () => {
		const root = "/virtual/task-publication";
		const file = join(root, "transaction", "journal");
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[file, `${TASK_PUBLICATION_JOURNAL_PREPARED}\n1\nissues\nreport`]]));
		const journal = new TaskPublicationJournalFile(file, file_io);

		expect({ available: journal.available(), state: journal.state() }).toEqual({
			available: true,
			state: {
				committed: false,
				rules_existed: true,
				existing_documents: ["issues", "report"],
				valid_rules_line: true,
				valid_documents: true,
			},
		});
	});

	test("treats a missing virtual journal as unavailable and invalid", () => {
		const journal = new TaskPublicationJournalFile("/virtual/missing/journal", new InMemoryFileIO());

		expect({ available: journal.available(), valid_rules_line: journal.state().valid_rules_line }).toEqual({
			available: false,
			valid_rules_line: false,
		});
	});
});
