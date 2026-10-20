import { join } from "node:path";
import type { TaskBatchReplacementContract, TaskReportingContract } from "src/task_protocols";
import type { ReportViolation } from "src/reporting_protocols";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

/** Responsibilities: _transaction recovery_, _document snapshots_. **/
export class TaskPublicationRecoveryScenario {
	private readonly fixture: TaskReportingMemoryWorkspace;
	private readonly batch: TaskBatchReplacementContract;
	private readonly task_root: string;

	/** Responsibilities: _recovery violation construction_. **/
	private violation(file: string, rule_id: string): ReportViolation {
		return {
			file,
			line: 1,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority: 3,
		};
	}

	/** Responsibilities: _recovery test setup_. **/
	public constructor(fixture: TaskReportingMemoryWorkspace, batch: TaskBatchReplacementContract) {
		this.fixture = fixture;
		this.batch = batch;
		this.task_root = join(this.fixture.root, ".ai-code-guard");
	}

	/** Responsibilities: _abandoned transaction preparation_. **/
	public prepare(reporting: TaskReportingContract): ReadonlyMap<string, string> {
		reporting.format([this.violation("a.ts", "parse-error")], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const previous = this.documents();
		const io = this.fixture.file_io;
		const transaction = io.directory_operations.temporary_directory(this.fixture.root, ".ai-code-guard-task-");
		io.directory_operations.move_path(join(this.task_root, "rules"), join(transaction, "rules"));
		io.directory_operations.create_directory(join(this.task_root, "rules"));
		io.file_content.write_text(join(this.task_root, "rules", "partial.md"), "partial\n");
		for (const document of ["issues", "report", "lint-output"] as const) {
			io.directory_operations.move_path(join(this.task_root, `${document}.md`), join(transaction, `${document}.md`));
		}
		io.file_content.write_text(join(transaction, "journal"), "1\nissues\nreport\nlint-output");
		const lock = join(this.task_root, ".task-publication-lock");
		io.directory_operations.create_directory(lock);
		io.file_content.write_text(join(lock, "owner"), `999999999\n${transaction}\n`);
		return previous;
	}

	/** Responsibilities: _failed publication attempt_. **/
	public fail_replacement(): void {
		this.batch.replace({
			staged_rules: join(this.fixture.root, "missing-staged-rules"),
			rule_ids: ["missing-rule"],
			issues: "next issues",
			documents: new Map(),
		});
	}

	/** Responsibilities: _published document snapshot_. **/
	public documents(): ReadonlyMap<string, string> {
		const io = this.fixture.file_io;
		return new Map([
			["issues", io.file_content.file_text(join(this.task_root, "issues.md"))],
			["report", io.file_content.file_text(join(this.task_root, "report.md"))],
		]);
	}
}
