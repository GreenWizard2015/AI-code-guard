import { ViolationValue } from "src/model/violation_value";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";
import type { TaskDocuments } from "tests/core/types";

/** Responsibilities: _task reporting test scenario_, _reporting fixture data_. **/
export class TaskReportingScenario {
	private readonly _fixture_factory: TaskReportingMemoryFixture;

	/** Responsibilities: _task reporting scenario initialization_. **/
	public constructor() {
		this._fixture_factory = new TaskReportingMemoryFixture();
	}

	/** Responsibilities: _reporting input files_. **/
	public reporting_files(): Record<string, string> {
		return {
			"a.ts": "const first = 1;\nconst second = 2;\nconst third = 3;\n",
			"b.ts": "const first = 1;\n",
		};
	}

	/** Responsibilities: _reporting input violations_. **/
	public reporting_violations(): ViolationValue[] {
		return [
			this.violation("a.ts", 1, "parse-error", 3),
			this.violation("a.ts", 2, "parse-error", 3),
			this.violation("a.ts", 3, "class-size", 3),
			this.violation("a.ts", 1, "unused-file", 2),
			this.violation("b.ts", 1, "parse-error", 3),
			this.violation("b.ts", 1, "unused-file", 2),
		];
	}

	/** Responsibilities: _individual reporting violation_. **/
	public violation(file: string, line: number, rule_id: string, priority: number): ViolationValue {
		return new ViolationValue({
			file,
			line,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority,
		});
	}

	/** Responsibilities: _reporting workspace creation_. **/
	public create_fixture(files: Record<string, string>): TaskReportingMemoryWorkspace {
		return this._fixture_factory.create(files);
	}

	/** Responsibilities: _task document access_. **/
	public documents(fixture: TaskReportingMemoryWorkspace, output: string): TaskDocuments {
		return {
			output,
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
		};
	}
}
