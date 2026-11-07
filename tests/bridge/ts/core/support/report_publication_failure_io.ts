import { join, resolve } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _task publication errors_, _rollback recovery_. **/
export class TaskPublicationFailureIO extends InMemoryFileIO {
	private readonly _failing_report: string;
	private _fail_report_write = false;
	private _fail_rules_restore = false;

	/** Responsibilities: _publication failure state_. **/
	public constructor(root: string) {
		super();
		this._failing_report = join(root, ".ai-code-guard", "report.md");
	}

	/** Responsibilities: _report failure configuration_. **/
	public fail_next_report_write(): void {
		this._fail_report_write = true;
	}

	/** Responsibilities: _rollback failure state_. **/
	public fail_next_rules_restore(): void {
		this._fail_rules_restore = true;
	}

	/** Responsibilities: _rollback file operation_. **/
	public override move_path(source: string, destination: string): void {
		if (this._fail_rules_restore && source.includes(".ai-code-guard-task-") && destination.endsWith("/rules")) {
			this._fail_rules_restore = false;
			throw new Error("EACCES: injected rollback failure");
		}
		super.move_path(source, destination);
	}

	/** Responsibilities: _failure interception_. **/
	public override write_text(file: string, text: string): void {
		if (this._fail_report_write) {
			if (resolve(file) === this._failing_report) {
				this._fail_report_write = false;
				throw new Error("Injected report publication failure");
			}
		}
		super.write_text(file, text);
	}
}
