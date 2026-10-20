import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
	REVIEW_CLEANUP_COMMON_DOCUMENT,
	REVIEW_COMMON_DOCUMENT,
	REVIEW_DOCUMENT_NAMES,
	REVIEW_FINDING_DOCUMENT,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_DOCUMENT,
	REVIEW_PREAMBLE_PLACEHOLDER,
} from "src/core/support/task/constants";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { RULE_DATA, RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TaskReviewMemoryWorkspace } from "tests/bridge/ts/core/task-review-memory-workspace";

/** Responsibilities: _CLI test workspace_, _in-memory source state_. **/
export class TaskReviewMemoryFixture {
	/** Responsibilities: _rule-document path selection_. **/
	private rule_document_paths(rule_id: string): readonly string[] {
		if (!RULE_DOCUMENT_PATHS_BY_ID.has(rule_id)) {
			return [`docs/rules/${rule_id}.md`];
		}
		const configured_paths = RULE_DOCUMENT_PATHS_BY_ID.get(rule_id);
		if (configured_paths === undefined) {
			return [`docs/rules/${rule_id}.md`];
		}
		return configured_paths;
	}

	/** Responsibilities: _virtual repository construction_. **/
	public create(source: string, source_file_name = "source.ts"): TaskReviewMemoryWorkspace {
		const root = `/virtual/task-review-cache-${randomUUID()}`;
		const source_file = join(root, source_file_name);
		const source_texts = new Map([[source_file, source]]);
		const files = new Map(source_texts);
		for (const rule_id of Object.keys(RULE_DATA)) {
			const paths = this.rule_document_paths(rule_id);
			for (const path of paths) {
				files.set(join(REPORTING_PROJECT_ROOT, path), `# ${path}\n`);
			}
		}
		const prompt = `# Architecture review agent instructions\n${REVIEW_PATH_PLACEHOLDER}\n${REVIEW_PREAMBLE_PLACEHOLDER}\n`;
		for (const file of REVIEW_DOCUMENT_NAMES) {
			files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", file), prompt);
		}
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT), "Review preamble.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_COMMON_DOCUMENT), "Allowed operations.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_CLEANUP_COMMON_DOCUMENT), "Cleanup operations.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_FINDING_DOCUMENT), "Finding requirements.\n");
		const io = new InMemoryFileIO();
		io.seed_files(files);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		return new TaskReviewMemoryWorkspace(root, io, source_texts, source_io);
	}
}
