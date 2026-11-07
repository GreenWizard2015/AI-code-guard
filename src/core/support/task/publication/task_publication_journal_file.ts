import {
	TASK_PUBLICATION_JOURNAL_COMMITTED,
	TASK_PUBLICATION_JOURNAL_RULE_FLAGS,
} from "src/core/support/task/constants";
import { TaskPublicationJournalContent } from "src/core/support/task/publication/task_publication_journal_content";
import type { TaskPublicationJournalState } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _journal file availability_, _publication state parsing_. **/
export class TaskPublicationJournalFile {
	private readonly _path: string;
	private readonly _file_io: IOContract;

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

	/** Responsibilities: _journal file identity_. **/
	public constructor(path: string, file_io: IOContract) {
		this._path = path;
		this._file_io = file_io;
	}

	/** Responsibilities: _journal file availability_. **/
	public available(): boolean {
		return this._file_io.path_is_file(this._path);
	}

	/** Responsibilities: _journal state_. **/
	public state(): TaskPublicationJournalState {
		if (!this.available()) {
			return this.invalid();
		}
		const lines = this._file_io.file(this._path).file_text().split("\n");
		const content = new TaskPublicationJournalContent(lines);
		const phase = content.phase();
		const rules_line = content.rules_line(phase);
		const document_state = content.prior_documents(phase);
		return {
			committed: phase.name === TASK_PUBLICATION_JOURNAL_COMMITTED,
			rules_existed: rules_line === "1",
			existing_documents: document_state.existing_documents,
			valid_rules_line: TASK_PUBLICATION_JOURNAL_RULE_FLAGS.has(rules_line),
			valid_documents: document_state.valid_documents,
		};
	}
}
