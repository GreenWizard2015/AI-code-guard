import {
	LINT_OUTPUT_DOCUMENT,
	TASK_PUBLICATION_JOURNAL_COMMITTED,
	TASK_PUBLICATION_JOURNAL_PHASES,
	TASK_PUBLICATION_JOURNAL_RULE_FLAGS,
} from "src/core/support/task/constants";
import type {
	TaskPublicationJournalDocumentState,
	TaskPublicationJournalPhase,
	TaskPublicationJournalState,
} from "src/core/support/task/types";
import type { TaskWorkspaceDocument } from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _journal file availability_, _publication state parsing_. **/
export class TaskPublicationJournalFile {
	private readonly path: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _invalid journal state_. **/
	private invalid(): TaskPublicationJournalState {
		return {
			committed: false,
			rules_existed: false,
			existing_documents: [],
			valid_rules_line: false,
			valid_documents: false,
		};
	}

	/** Responsibilities: _journal document state_. **/
	private documents(lines: readonly string[]): TaskPublicationJournalDocumentState {
		const known = new Set<string>(["issues", "report", LINT_OUTPUT_DOCUMENT]);
		const existing_documents: TaskWorkspaceDocument[] = [];
		let valid_documents = true;
		for (const line of lines) {
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
	private phase(lines: readonly string[]): TaskPublicationJournalPhase {
		let name = "";
		const first = lines.at(0);
		if (first !== undefined) {
			name = first;
		}
		if (TASK_PUBLICATION_JOURNAL_PHASES.has(name)) {
			return { name, index: 1 };
		}
		return { name: "", index: 0 };
	}

	/** Responsibilities: _journal line state_. **/
	private line(lines: readonly string[], index: number): string {
		const value = lines.at(index);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _journal line parsing_. **/
	private parse(lines: readonly string[]): TaskPublicationJournalState {
		const phase = this.phase(lines);
		const rules_line = this.line(lines, phase.index);
		const document_state = this.documents(lines.slice(phase.index + 1));
		const valid_rules_line = TASK_PUBLICATION_JOURNAL_RULE_FLAGS.has(rules_line);
		return {
			committed: phase.name === TASK_PUBLICATION_JOURNAL_COMMITTED,
			rules_existed: rules_line === "1",
			existing_documents: document_state.existing_documents,
			valid_rules_line,
			valid_documents: document_state.valid_documents,
		};
	}

	/** Responsibilities: _journal file identity_. **/
	public constructor(path: string, file_io: IOContract) {
		this.path = path;
		this.file_io = file_io;
	}

	/** Responsibilities: _journal file availability_. **/
	public available(): boolean {
		return this.file_io.directory_entries.path_kind(this.path) === "file";
	}

	/** Responsibilities: _journal state_. **/
	public state(): TaskPublicationJournalState {
		if (!this.available()) {
			return this.invalid();
		}
		return this.parse(this.file_io.file_content.file_text(this.path).split("\n"));
	}
}
