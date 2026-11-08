import { join } from "node:path";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import {
	REVIEW_COMMON_DOCUMENT,
	REVIEW_DOCUMENT_NAMES,
	REVIEW_FINDING_DOCUMENT,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_DOCUMENT,
	REVIEW_PREAMBLE_PLACEHOLDER,
} from "src/core/support/task/constants";
import { ON_REVIEW_DOCUMENT } from "src/core/support/task/review-agent/constants";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _review test workspace_, _agent prompt data_. **/
export class TaskReviewAgentFixture {
	public readonly root = "/virtual/task-review-agent";
	public readonly _io: InMemoryFileIO;

	/** Responsibilities: _review workspace state_. **/
	public constructor() {
		this._io = new InMemoryFileIO();
	}

	/** Responsibilities: _review test workspace seeding_. **/
	public initialize(): void {
		const root = this.root;
		const prompt = `# Architecture review agent instructions\n${REVIEW_PATH_PLACEHOLDER}\n${REVIEW_PREAMBLE_PLACEHOLDER}\n`;
		const files = new Map<string, string>([[join(root, "source.ts"), "export const initial = true;\n"]]);
		for (const file of REVIEW_DOCUMENT_NAMES) {
			files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", file), prompt);
		}
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_PREAMBLE_DOCUMENT), "Review preamble.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_COMMON_DOCUMENT), "Allowed operations.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", REVIEW_FINDING_DOCUMENT), "Finding requirements.\n");
		files.set(join(REPORTING_PROJECT_ROOT, "docs", "agent", ON_REVIEW_DOCUMENT), "Defects remaining to find: {N}.\n");
		this._io.seed_files(files);
	}
}
