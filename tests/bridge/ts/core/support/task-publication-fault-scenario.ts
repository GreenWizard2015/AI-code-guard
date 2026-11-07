import { basename, dirname, join } from "node:path";
import type { TaskBatchReplacementOptions, TaskWorkspaceDocument } from "src/task_types";
import { TaskPublicationFaultIO } from "tests/bridge/ts/core/support/task-publication-fault-io";

/** Responsibilities: _publication test setup_, _transaction state observation_. **/
export class TaskPublicationFaultScenario {
	private readonly _file_io: TaskPublicationFaultIO;
	private readonly _root: string;
	private readonly _workspace_root: string;
	private readonly _rules_root: string;
	private readonly _rule_id = "parse-error";
	private readonly _staged_rules: string;

	/** Responsibilities: _transaction owner observation_. **/
	private transaction_state(transaction: string): {
		transaction_exists: boolean;
		transaction_listed: boolean;
		owner_exists: boolean;
		owner_references_transaction: boolean;
	} {
		const owner_path = join(this._workspace_root, ".task-publication-lock", "owner");
		const owner_exists = this._file_io.file(owner_path).path_exists();
		let owner = "";
		if (owner_exists) {
			owner = this._file_io.file(owner_path).file_text();
		}
		return {
			transaction_exists: this._file_io.file(transaction).path_exists(),
			transaction_listed: this._file_io
				.list_entries(dirname(this._workspace_root))
				.some((entry) => entry.name === basename(transaction)),
			owner_exists,
			owner_references_transaction: owner.includes(`${transaction}\n`),
		};
	}

	/** Responsibilities: _retained file observation_. **/
	private retained_files(transaction: string): {
		issues: string;
		report: string;
		rule: string;
		backup_issues: string;
		backup_report: string;
		backup_rule: string;
	} {
		return {
			issues: this.document("issues"),
			report: this.document("report"),
			rule: this._file_io.file(this.rule_path()).file_text(),
			backup_issues: this.backup(transaction, "issues.md"),
			backup_report: this.backup(transaction, "report.md"),
			backup_rule: this.backup(transaction, join("rules", `${this._rule_id}.md`)),
		};
	}

	/** Responsibilities: _backup file observation_. **/
	private backup(transaction: string, path: string): string {
		const file = this._file_io.file(join(transaction, path));
		if (!file.path_exists()) {
			return "";
		}
		return file.file_text();
	}

	/** Responsibilities: _task document observation_. **/
	private document(name: "issues" | "report"): string {
		return this._file_io.file(join(this._workspace_root, `${name}.md`)).file_text();
	}

	/** Responsibilities: _rule document path access_. **/
	private rule_path(): string {
		return join(this._rules_root, `${this._rule_id}.md`);
	}

	/** Responsibilities: _publication fixture setup_. **/
	public constructor(root: string) {
		this._root = root;
		this._workspace_root = join(root, ".ai-code-guard");
		this._rules_root = join(this._workspace_root, "rules");
		this._file_io = new TaskPublicationFaultIO();
		this._file_io.create_directory(root);
		this._file_io.create_directory(this._workspace_root);
		this._staged_rules = join(root, "staged-rules");
		this._file_io.create_directory(this._staged_rules);
		this._file_io.file(join(this._workspace_root, "issues.md")).write_text("previous issues\n");
		this._file_io.file(join(this._workspace_root, "report.md")).write_text("previous report\n");
		this._file_io.create_directory(this._rules_root);
		this._file_io.file(this.rule_path()).write_text("previous rule\n");
	}

	/** Responsibilities: _project root access_. **/
	public root(): string {
		return this._root;
	}

	/** Responsibilities: _publication directory access_. **/
	public workspace_root(): string {
		return this._workspace_root;
	}

	/** Responsibilities: _rule directory access_. **/
	public rules_root(): string {
		return this._rules_root;
	}

	/** Responsibilities: _publication IO access_. **/
	public file_io(): TaskPublicationFaultIO {
		return this._file_io;
	}

	/** Responsibilities: _staged rule writing_. **/
	public stage_rule(content: string): void {
		const path = join(this._staged_rules, basename(this.rule_path()));
		this._file_io.file(path).write_text(content);
	}

	/** Responsibilities: _replacement request construction_. **/
	public request(issues: string, report: string): TaskBatchReplacementOptions {
		return {
			staged_rules: this._staged_rules,
			rule_ids: [this._rule_id],
			issues,
			documents: new Map<TaskWorkspaceDocument, string>([["report", report]]),
		};
	}

	/** Responsibilities: _retained transaction observation_. **/
	public retained_state(): {
		transaction_exists: boolean;
		transaction_listed: boolean;
		owner_exists: boolean;
		owner_references_transaction: boolean;
		issues: string;
		report: string;
		rule: string;
		backup_issues: string;
		backup_report: string;
		backup_rule: string;
	} {
		const transaction = this._file_io.latest_transaction();
		return { ...this.transaction_state(transaction), ...this.retained_files(transaction) };
	}

	/** Responsibilities: _published workspace observation_. **/
	public published_state(): {
		transactions_removed: boolean;
		issues: string;
		report: string;
		rule: string;
	} {
		return {
			transactions_removed: this._file_io
				.allocated_transactions()
				.every((path) => !this._file_io.file(path).path_exists()),
			issues: this.document("issues"),
			report: this.document("report"),
			rule: this._file_io.file(this.rule_path()).file_text(),
		};
	}
}
