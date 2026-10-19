import type { TaskWorkspaceDocument } from "src/types";
import type {
	TaskPublicationJournalContract,
	TaskPublicationJournalState,
} from "src/core/support/task/types";

/** Responsibilities: _published rules restoration state_, _report document restoration state_. **/
export class TaskPublicationJournal implements TaskPublicationJournalContract {
	private readonly journal_state: TaskPublicationJournalState;

	/** Responsibilities: _publication journal initialization_. **/
	public constructor(state: TaskPublicationJournalState) {
		this.journal_state = state;
	}

	/** Responsibilities: _publication commit phase validation_. **/
	public committed(): boolean {
		if (!this.journal_state.valid_rules_line || !this.journal_state.valid_documents) {
			return false;
		}
		return this.journal_state.committed;
	}

	/** Responsibilities: _publication rules restoration_. **/
	public rules_to_restore(): boolean {
		if (!this.journal_state.valid_rules_line) {
			return false;
		}
		return this.journal_state.rules_existed;
	}

	/** Responsibilities: _publication journal validation_. **/
	public valid(): boolean {
		if (!this.journal_state.valid_rules_line) {
			return false;
		}
		return this.journal_state.valid_documents;
	}

	/** Responsibilities: _publication document snapshot_. **/
	public prior_documents(): readonly TaskWorkspaceDocument[] {
		return [...this.journal_state.existing_documents];
	}
}
