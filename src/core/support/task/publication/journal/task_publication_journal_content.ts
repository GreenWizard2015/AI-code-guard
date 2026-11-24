import { LINT_OUTPUT_DOCUMENT, TASK_PUBLICATION_JOURNAL_PHASES } from "src/core/support/task/constants";
import type { TaskPublicationJournalDocumentState, TaskPublicationJournalPhase } from "src/core/support/task/types";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _journal line context_, _prior document names_. **/
export class TaskPublicationJournalContent {
	private readonly _lines: readonly string[];

	/** Responsibilities: _journal content initialization_. **/
	public constructor(lines: readonly string[]) {
		this._lines = lines;
	}

	/** Responsibilities: _journal document state_. **/
	public prior_documents(phase: TaskPublicationJournalPhase): TaskPublicationJournalDocumentState {
		const known = new Set<string>(["issues", "report", LINT_OUTPUT_DOCUMENT]);
		const existing_documents: TaskWorkspaceDocument[] = [];
		let valid_documents = true;
		for (const line of this._lines.slice(phase.index + 1)) {
			if (line.length === 0) {
				continue;
			}
			if (!known.has(line)) {
				valid_documents = false;
				continue;
			}
			if (line === "issues" || line === "report" || line === LINT_OUTPUT_DOCUMENT) {
				existing_documents.push(line);
			}
		}
		return { existing_documents, valid_documents };
	}

	/** Responsibilities: _journal phase state_. **/
	public phase(): TaskPublicationJournalPhase {
		let name = "";
		const first = this._lines.at(0);
		if (first !== undefined) {
			name = first;
		}
		if (TASK_PUBLICATION_JOURNAL_PHASES.has(name)) {
			return { name, index: 1 };
		}
		return { name: "", index: 0 };
	}

	/** Responsibilities: _journal line state_. **/
	public rules_line(phase: TaskPublicationJournalPhase): string {
		const value = this._lines.at(phase.index);
		if (value === undefined) {
			return "";
		}
		return value;
	}
}
