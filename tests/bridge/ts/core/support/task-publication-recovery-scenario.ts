import { join } from "node:path";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import type { TaskBatchReplacementContract, TaskReportingContract } from "src/task_protocols";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

/** Responsibilities: _transaction recovery_, _document snapshots_. **/
export class TaskPublicationRecoveryScenario {
	private readonly _fixture: TaskReportingMemoryWorkspace;
	private readonly _batch: TaskBatchReplacementContract;
	private readonly _task_root: string;

	/** Responsibilities: _recovery violation construction_. **/
	private violation(file: string, rule_id: string): ViolationContract {
		return new ViolationValue({
			file,
			line: 1,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority: 3,
		});
	}

	/** Responsibilities: _recovery test setup_. **/
	public constructor(fixture: TaskReportingMemoryWorkspace, batch: TaskBatchReplacementContract) {
		this._fixture = fixture;
		this._batch = batch;
		this._task_root = join(this._fixture._root, ".ai-code-guard");
	}

	/** Responsibilities: _abandoned transaction preparation_. **/
	public prepare(reporting: TaskReportingContract): ReadonlyMap<string, string> {
		reporting.format([this.violation("a.ts", "parse-error")], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const previous = this.documents();
		const io = this._fixture._file_io;
		const transaction = io.temporary_directory(this._fixture._root, ".ai-code-guard-task-");
		io.move_path(join(this._task_root, "rules"), join(transaction, "rules"));
		io.create_directory(join(this._task_root, "rules"));
		io.file(join(this._task_root, "rules", "partial.md")).write_text("partial\n");
		for (const document of ["issues", "report", "lint-output"] as const) {
			io.move_path(join(this._task_root, `${document}.md`), join(transaction, `${document}.md`));
		}
		io.file(join(transaction, "journal")).write_text("1\nissues\nreport\nlint-output");
		const lock = join(this._task_root, ".task-publication-lock");
		io.create_directory(lock);
		io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\n`);
		return previous;
	}

	/** Responsibilities: _failed publication attempt_. **/
	public fail_replacement(): void {
		this._batch.replace({
			staged_rules: join(this._fixture._root, "missing-staged-rules"),
			rule_ids: ["missing-rule"],
			issues: "next issues",
			documents: new Map(),
		});
	}

	/** Responsibilities: _published document snapshot_. **/
	public documents(): ReadonlyMap<string, string> {
		const io = this._fixture._file_io;
		const documents = new Map<string, string>();
		for (const document of ["issues", "report", "lint-output"] as const) {
			documents.set(document, io.file(join(this._task_root, `${document}.md`)).file_text());
		}
		const rules_root = join(this._task_root, "rules");
		for (const path of io.list_files(rules_root)) {
			documents.set(`rules/${path}`, io.file(join(rules_root, path)).file_text());
		}
		return documents;
	}
}
